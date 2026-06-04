import { randomUUID } from 'node:crypto'
import { db, employeeProfile, kioskDevice, organizations, timeEntry, user } from '@takt/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashDeviceToken, hashPin } from '../lib/crypto'
import { registerDevice } from '../services/device'
import { setEmployeePin } from '../services/employee'
import { submitKioskPunch } from '../services/punch'

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const userA = `user_${randomUUID()}`
const userB = `user_${randomUUID()}`
let profileA = ''
let _profileB = ''
let deviceId = ''
let _deviceToken = ''

const ctxOwnerA = () => ({ orgId: orgA, userId: userA, memberRole: 'owner' })
const ctxOwnerB = () => ({ orgId: orgB, userId: userB, memberRole: 'owner' })

function kioskInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    employeeId: profileA,
    pin: '1234',
    clientUuid: randomUUID(),
    type: 'clock_in' as const,
    capturedAtClient: new Date().toISOString(),
    ...overrides,
  }
}

beforeAll(async () => {
  await db.insert(organizations).values([
    { id: orgA, name: 'Kiosk Org A' },
    { id: orgB, name: 'Kiosk Org B' },
  ])
  await db.insert(user).values([
    { id: userA, name: 'Kiosk A', email: `${userA}@t.test` },
    { id: userB, name: 'Kiosk B', email: `${userB}@t.test` },
  ])
  const [pa] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: userA, pinHash: await hashPin('1234') })
    .returning({ id: employeeProfile.id })
  const [pb] = await db
    .insert(employeeProfile)
    .values({ orgId: orgB, userId: userB, pinHash: await hashPin('1234') })
    .returning({ id: employeeProfile.id })
  profileA = pa!.id
  _profileB = pb!.id

  const result = await registerDevice(db, ctxOwnerA(), { name: 'Floor tablet' })
  deviceId = result.deviceId
  _deviceToken = result.token
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgB))
  await db.delete(kioskDevice).where(eq(kioskDevice.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  await db.delete(user).where(eq(user.id, userA))
  await db.delete(user).where(eq(user.id, userB))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
})

describe('submitKioskPunch', () => {
  it('happy path: writes a valid kiosk entry with source=kiosk', async () => {
    const input = kioskInput()
    const out = await submitKioskPunch(db, { orgId: orgA, deviceId }, input as never)
    expect(out.entryId).toMatch(/[0-9a-f-]{36}/)
    expect(out.status).toBe('valid')
    const rows = await db.select().from(timeEntry).where(eq(timeEntry.clientUuid, input.clientUuid))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.source).toBe('kiosk')
  })

  it('wrong PIN: returns UNAUTHORIZED', async () => {
    await expect(
      submitKioskPunch(db, { orgId: orgA, deviceId }, kioskInput({ pin: '9999' }) as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('cross-tenant: org-A device cannot punch org-B employee', async () => {
    const input = kioskInput({ employeeId: _profileB })
    await expect(
      submitKioskPunch(db, { orgId: orgA, deviceId }, input as never),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    const rows = await db.select().from(timeEntry).where(eq(timeEntry.clientUuid, input.clientUuid))
    expect(rows).toHaveLength(0)
  })

  it('idempotent replay: same clientUuid returns same entryId, one row', async () => {
    const input = kioskInput()
    const first = await submitKioskPunch(db, { orgId: orgA, deviceId }, input as never)
    const second = await submitKioskPunch(db, { orgId: orgA, deviceId }, input as never)
    expect(second.entryId).toBe(first.entryId)
    const rows = await db.select().from(timeEntry).where(eq(timeEntry.clientUuid, input.clientUuid))
    expect(rows).toHaveLength(1)
  })
})

describe('registerDevice', () => {
  it('stores hash only, returns 64-char token, siteId is NULL when omitted', async () => {
    const { deviceId: newDeviceId, token } = await registerDevice(db, ctxOwnerA(), { name: 'Test tablet' })
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const [row] = await db.select().from(kioskDevice).where(eq(kioskDevice.id, newDeviceId))
    expect(row!.tokenHash).toBe(hashDeviceToken(token))
    expect(row!.tokenHash).not.toBe(token)
    expect(row!.siteId).toBeNull()
  })
})

describe('setEmployeePin', () => {
  it('cross-tenant: orgB context cannot update orgA employee', async () => {
    await expect(
      setEmployeePin(db, ctxOwnerB(), { employeeId: profileA, pin: '5678' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
