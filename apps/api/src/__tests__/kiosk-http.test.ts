import { randomUUID } from 'node:crypto'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'
import { hashPin, registerDevice } from '@takt/api'
import { db, employeeProfile, kioskDevice, organizations, timeEntry, user } from '@takt/db'
import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

let app: FastifyInstance
let baseUrl = ''

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const ownerUserId = `user_${randomUUID()}`

let rosterWorkerAId = ''
let noPinWorkerAId = ''
let inactiveWorkerAId = ''
let punchWorkerAId = ''
let workerBId = ''
let deviceToken = ''
const createdUserIds: string[] = []

beforeAll(async () => {
  app = buildApp()
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

  await db.insert(organizations).values([
    { id: orgA, name: 'Kiosk HTTP Org A', slug: `kiosk-a-${orgA.slice(-8)}` },
    { id: orgB, name: 'Kiosk HTTP Org B', slug: `kiosk-b-${orgB.slice(-8)}` },
  ])
  await db.insert(user).values({ id: ownerUserId, name: 'Kiosk Owner', email: `${ownerUserId}@t.test` })
  createdUserIds.push(ownerUserId)

  // rosterWorkerA: orgA, PIN set, active -> must appear in roster
  const ruId = `user_${randomUUID()}`
  await db.insert(user).values({ id: ruId, name: 'Alice Roster', email: `${ruId}@t.test` })
  createdUserIds.push(ruId)
  const [rwa] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: ruId, pinHash: await hashPin('1234'), active: true })
    .returning({ id: employeeProfile.id })
  rosterWorkerAId = rwa!.id

  // Seed a clock_in entry so rosterWorkerA has state=clocked_in
  await db.insert(timeEntry).values({
    clientUuid: randomUUID(),
    orgId: orgA,
    employeeId: rosterWorkerAId,
    type: 'clock_in',
    source: 'kiosk',
    capturedAtClient: new Date(),
  })

  // noPinWorkerA: orgA, active, pinHash=null -> must be absent from roster
  const npId = `user_${randomUUID()}`
  await db.insert(user).values({ id: npId, name: 'Bob NoPin', email: `${npId}@t.test` })
  createdUserIds.push(npId)
  const [npw] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: npId, pinHash: null, active: true })
    .returning({ id: employeeProfile.id })
  noPinWorkerAId = npw!.id

  // inactiveWorkerA: orgA, PIN set, active=false -> must be absent from roster
  const iaId = `user_${randomUUID()}`
  await db.insert(user).values({ id: iaId, name: 'Carol Inactive', email: `${iaId}@t.test` })
  createdUserIds.push(iaId)
  const [iaw] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: iaId, pinHash: await hashPin('4321'), active: false })
    .returning({ id: employeeProfile.id })
  inactiveWorkerAId = iaw!.id

  // punchWorkerA: orgA, PIN '1234', active -> target for punch-over-HTTP test
  const pwId = `user_${randomUUID()}`
  await db.insert(user).values({ id: pwId, name: 'Dave Punch', email: `${pwId}@t.test` })
  createdUserIds.push(pwId)
  const [pw] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: pwId, pinHash: await hashPin('1234'), active: true })
    .returning({ id: employeeProfile.id })
  punchWorkerAId = pw!.id

  // workerB: orgB, PIN set -> cross-tenant negative target
  const wbId = `user_${randomUUID()}`
  await db.insert(user).values({ id: wbId, name: 'Eve OrgB', email: `${wbId}@t.test` })
  createdUserIds.push(wbId)
  const [wb] = await db
    .insert(employeeProfile)
    .values({ orgId: orgB, userId: wbId, pinHash: await hashPin('5678'), active: true })
    .returning({ id: employeeProfile.id })
  workerBId = wb!.id

  const { token } = await registerDevice(
    db,
    { orgId: orgA, userId: ownerUserId, memberRole: 'owner' },
    { name: 'Floor tablet' },
  )
  deviceToken = token
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgB))
  await db.delete(kioskDevice).where(eq(kioskDevice.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  if (createdUserIds.length > 0) {
    await db.delete(user).where(inArray(user.id, createdUserIds))
  }
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
  await app.close()
})

describe('kiosk HTTP boundary', () => {
  it('missing token -> UNAUTHORIZED', async () => {
    const link = new RPCLink({ url: `${baseUrl}/api/v1/rpc`, headers: () => ({}) })
    const c: RouterClient<Router> = createORPCClient(link)
    await expect(c.time.punch.kioskRoster()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('bogus token -> UNAUTHORIZED', async () => {
    const link = new RPCLink({
      url: `${baseUrl}/api/v1/rpc`,
      headers: () => ({ 'x-takt-device-token': 'deadbeef'.repeat(8) }),
    })
    const c: RouterClient<Router> = createORPCClient(link)
    await expect(c.time.punch.kioskRoster()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('kioskRoster happy path: returns PIN+active workers, excludes no-PIN and inactive', async () => {
    const link = new RPCLink({
      url: `${baseUrl}/api/v1/rpc`,
      headers: () => ({ 'x-takt-device-token': deviceToken }),
    })
    const c: RouterClient<Router> = createORPCClient(link)
    const roster = await c.time.punch.kioskRoster()

    // rosterWorkerA is present with clocked_in state (seeded clock_in entry)
    const rwa = roster.find((r) => r.employeeId === rosterWorkerAId)
    expect(rwa).toBeDefined()
    expect(rwa!.state).toBe('clocked_in')

    // punchWorkerA is also present (PIN set, active, no entries -> clocked_out)
    const pwa = roster.find((r) => r.employeeId === punchWorkerAId)
    expect(pwa).toBeDefined()
    expect(pwa!.state).toBe('clocked_out')

    // noPinWorkerA is absent
    expect(roster.some((r) => r.employeeId === noPinWorkerAId)).toBe(false)

    // inactiveWorkerA is absent
    expect(roster.some((r) => r.employeeId === inactiveWorkerAId)).toBe(false)
  })

  it('kioskRoster cross-tenant: orgA worker present, orgB worker absent', async () => {
    const link = new RPCLink({
      url: `${baseUrl}/api/v1/rpc`,
      headers: () => ({ 'x-takt-device-token': deviceToken }),
    })
    const c: RouterClient<Router> = createORPCClient(link)
    const roster = await c.time.punch.kioskRoster()

    // positive: at least one orgA row
    expect(roster.some((r) => r.employeeId === rosterWorkerAId)).toBe(true)
    // negative: orgB worker absent
    expect(roster.every((r) => r.employeeId !== workerBId)).toBe(true)
  })

  it('kiosk punch over HTTP: valid entry returned', async () => {
    const link = new RPCLink({
      url: `${baseUrl}/api/v1/rpc`,
      headers: () => ({ 'x-takt-device-token': deviceToken }),
    })
    const c: RouterClient<Router> = createORPCClient(link)
    const out = await c.time.punch.kiosk({
      employeeId: punchWorkerAId,
      pin: '1234',
      clientUuid: randomUUID(),
      type: 'clock_in',
      capturedAtClient: new Date().toISOString(),
    })
    expect(out.status).toBe('valid')
    expect(out.entryId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('cross-tenant punch: orgA token cannot punch orgB employee -> UNAUTHORIZED', async () => {
    const link = new RPCLink({
      url: `${baseUrl}/api/v1/rpc`,
      headers: () => ({ 'x-takt-device-token': deviceToken }),
    })
    const c: RouterClient<Router> = createORPCClient(link)
    await expect(
      c.time.punch.kiosk({
        employeeId: workerBId,
        pin: '5678',
        clientUuid: randomUUID(),
        type: 'clock_in',
        capturedAtClient: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
