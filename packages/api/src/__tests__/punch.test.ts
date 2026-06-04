import { randomUUID } from 'node:crypto'
import { db, employeeProfile, organizations, timeEntry, user, withOrgCtx } from '@takt/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { submitPunch } from '../services/punch'

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const userA = `user_${randomUUID()}`
const userB = `user_${randomUUID()}`
let profileA = ''
let _profileB = ''

const ctxA = () => ({ orgId: orgA, userId: userA, memberRole: 'employee' })
const ctxB = () => ({ orgId: orgB, userId: userB, memberRole: 'employee' })

function punch(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    clientUuid: randomUUID(),
    type: 'clock_in' as const,
    source: 'in_app' as const,
    capturedAtClient: new Date().toISOString(),
    ...overrides,
  }
}

beforeAll(async () => {
  await db.insert(organizations).values([
    { id: orgA, name: 'Org A' },
    { id: orgB, name: 'Org B' },
  ])
  await db.insert(user).values([
    { id: userA, name: 'A', email: `${userA}@t.test` },
    { id: userB, name: 'B', email: `${userB}@t.test` },
  ])
  const [pa] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: userA })
    .returning({ id: employeeProfile.id })
  const [pb] = await db
    .insert(employeeProfile)
    .values({ orgId: orgB, userId: userB })
    .returning({ id: employeeProfile.id })
  profileA = pa!.id
  _profileB = pb!.id
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgB))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  await db.delete(user).where(eq(user.id, userA))
  await db.delete(user).where(eq(user.id, userB))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
})

describe('submitPunch', () => {
  it('happy path: writes one valid in_app entry', async () => {
    const input = punch()
    const out = await submitPunch(db, ctxA(), input as never)
    expect(out.entryId).toMatch(/[0-9a-f-]{36}/)
    expect(out.status).toBe('valid')
    expect(out.inZone).toBeNull()
    expect(out.irregularities).toEqual([])
    expect(Number.isNaN(Date.parse(out.recordedAtServer))).toBe(false)
    const rows = await db.select().from(timeEntry).where(eq(timeEntry.clientUuid, input.clientUuid))
    expect(rows).toHaveLength(1)
  })

  it('idempotent replay: same clientUuid returns same entry, no second row', async () => {
    const input = punch()
    const first = await submitPunch(db, ctxA(), input as never)
    const second = await submitPunch(db, ctxA(), input as never)
    expect(second.entryId).toBe(first.entryId)
    const rows = await db.select().from(timeEntry).where(eq(timeEntry.clientUuid, input.clientUuid))
    expect(rows).toHaveLength(1)
  })

  it('cross-tenant RLS denial: org B context cannot write org A data', async () => {
    await expect(
      withOrgCtx(db, ctxB(), async (tx) => {
        await tx.insert(timeEntry).values({
          clientUuid: randomUUID(),
          orgId: orgA, // mismatched: app.org_id = orgB
          employeeId: profileA,
          type: 'clock_in',
          source: 'in_app',
          capturedAtClient: new Date(),
        })
      }),
    // DrizzleQueryError wraps the PostgresError; code '42501' = INSUFFICIENT_PRIVILEGE from the RLS WITH CHECK policy
    ).rejects.toMatchObject({ cause: { code: '42501' } })
  })
})
