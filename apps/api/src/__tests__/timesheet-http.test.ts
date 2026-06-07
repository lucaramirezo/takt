import { randomUUID } from 'node:crypto'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'
import { db, employeeProfile, orgMembers, organizations, session, timeEntry, user, withOrgCtx } from '@takt/db'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

const AUTH_ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let app: FastifyInstance
let baseUrl = ''

const ownerCookies = new Map<string, string>()
const employeeCookies = new Map<string, string>()

function cookiesFor(jar: Map<string, string>) {
  return () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function storeCookiesInto(jar: Map<string, string>, res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(';', 1)[0]!
    const i = pair.indexOf('=')
    jar.set(pair.slice(0, i), pair.slice(i + 1))
  }
}

async function signUp(jar: Map<string, string>, email: string, name: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: AUTH_ORIGIN },
    body: JSON.stringify({ email, password: 'Sup3rSecret!pw', name }),
  })
  expect(res.status).toBe(200)
  storeCookiesInto(jar, res)
  return ((await res.json()) as { user: { id: string } }).user.id
}

function clientFor(cookieHeaderFn: () => string): RouterClient<Router> {
  const link = new RPCLink({
    url: `${baseUrl}/api/v1/rpc`,
    headers: () => ({ cookie: cookieHeaderFn() }),
  })
  return createORPCClient<RouterClient<Router>>(link)
}

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`

let ownerUserId = ''
let employeeUserId = ''
const userBId = `user_${randomUUID()}`

let ownerProfileId = ''
let employeeProfileId = ''
let orgBProfileId = ''

beforeAll(async () => {
  app = buildApp()
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

  ownerUserId = await signUp(ownerCookies, `ts_owner_${randomUUID()}@takt.test`, 'TS Owner')
  employeeUserId = await signUp(employeeCookies, `ts_emp_${randomUUID()}@takt.test`, 'TS Employee')

  await db.insert(organizations).values([
    { id: orgA, name: 'TS Org A', slug: `ts-a-${orgA.slice(-8)}` },
    { id: orgB, name: 'TS Org B', slug: `ts-b-${orgB.slice(-8)}` },
  ])

  await db.insert(orgMembers).values([
    { id: `member_${randomUUID()}`, userId: ownerUserId, orgId: orgA, role: 'owner' },
    { id: `member_${randomUUID()}`, userId: employeeUserId, orgId: orgA, role: 'employee' },
  ])

  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, ownerUserId))
  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, employeeUserId))

  const [op] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: ownerUserId })
    .returning({ id: employeeProfile.id })
  ownerProfileId = op!.id

  const [ep] = await db
    .insert(employeeProfile)
    .values({ orgId: orgA, userId: employeeUserId })
    .returning({ id: employeeProfile.id })
  employeeProfileId = ep!.id

  // Seed orgB with a real user + profile + time_entry (cross-tenant negative target)
  await db.insert(user).values({ id: userBId, name: 'User B', email: `${userBId}@t.test` })
  const [bp] = await db
    .insert(employeeProfile)
    .values({ orgId: orgB, userId: userBId })
    .returning({ id: employeeProfile.id })
  orgBProfileId = bp!.id

  const now = new Date()
  // Seed time_entry rows for orgA (owner + employee)
  await db.insert(timeEntry).values([
    { clientUuid: randomUUID(), orgId: orgA, employeeId: ownerProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: ownerProfileId, type: 'clock_out', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: employeeProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: employeeProfileId, type: 'clock_out', source: 'in_app', capturedAtClient: now },
  ])
  // Seed orgB time_entry (real cross-tenant row)
  await db.insert(timeEntry).values({
    clientUuid: randomUUID(), orgId: orgB, employeeId: orgBProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now,
  })
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgB))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  await db.delete(organizations).where(eq(organizations.id, orgB))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  if (ownerUserId) await db.delete(user).where(eq(user.id, ownerUserId))
  if (employeeUserId) await db.delete(user).where(eq(user.id, employeeUserId))
  await db.delete(user).where(eq(user.id, userBId))
  await app.close()
})

describe('time.timesheet.get HTTP legs', () => {
  it('no-cookie client -> UNAUTHORIZED', async () => {
    const noAuthLink = new RPCLink({ url: `${baseUrl}/api/v1/rpc`, headers: () => ({}) })
    const noAuthClient: RouterClient<Router> = createORPCClient(noAuthLink)
    await expect(noAuthClient.time.timesheet.get({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('owner -> sees all-org entries (>= 2 distinct employeeIds)', async () => {
    const client = clientFor(cookiesFor(ownerCookies))
    const out = await client.time.timesheet.get({})
    const distinctIds = new Set(out.entries.map((e) => e.employeeId))
    expect(distinctIds.size).toBeGreaterThanOrEqual(2)
    expect(out.entries.some((e) => e.employeeId === ownerProfileId)).toBe(true)
  })

  it('employee -> only own entries (self-scope)', async () => {
    const client = clientFor(cookiesFor(employeeCookies))
    const out = await client.time.timesheet.get({})
    expect(out.entries.length).toBeGreaterThan(0)
    expect(out.entries.every((e) => e.employeeId === employeeProfileId)).toBe(true)
  })

  it('cross-tenant: owner does not see orgB entries', async () => {
    const client = clientFor(cookiesFor(ownerCookies))
    const out = await client.time.timesheet.get({})
    expect(out.entries.every((e) => e.employeeId !== orgBProfileId)).toBe(true)
  })

  it('RLS hard leg: orgB context cannot read orgA entries', async () => {
    await expect(
      withOrgCtx(db, { orgId: orgB, userId: userBId, memberRole: 'employee' }, async (tx) => {
        await tx.insert(timeEntry).values({
          clientUuid: randomUUID(),
          orgId: orgA,
          employeeId: ownerProfileId,
          type: 'clock_in',
          source: 'in_app',
          capturedAtClient: new Date(),
        })
      }),
    ).rejects.toMatchObject({ cause: { code: '42501' } })
  })
})
