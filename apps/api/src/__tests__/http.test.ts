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

// Better Auth's trusted origin = its baseURL (default http://localhost:3000). The server listens on
// an ephemeral port, so we send this Origin explicitly on every auth call to pass the CSRF/origin gate.
const AUTH_ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let app: FastifyInstance
let baseUrl = ''
const cookies = new Map<string, string>()

const cookieHeader = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
function storeCookies(res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(';', 1)[0]!
    const i = pair.indexOf('=')
    cookies.set(pair.slice(0, i), pair.slice(i + 1))
  }
}
async function authPost(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: AUTH_ORIGIN, cookie: cookieHeader() },
    body: JSON.stringify(body),
  })
  storeCookies(res)
  return res
}

// All IDs known at declaration time — afterAll cleanup is unconditional.
const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const userB = `user_${randomUUID()}`
const memberA = `mem_${randomUUID()}`
let userA = ''
let profileA = ''

beforeAll(async () => {
  app = buildApp()
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' }) // Fastify resolves to the full URL string

  // 1. Sign up over Better Auth HTTP — sole purpose: obtain a real session cookie for userA.
  const email = `it_${randomUUID()}@takt.test`
  const signUp = await authPost('/api/auth/sign-up/email', { email, password: 'Sup3rSecret!pw', name: 'IT User' })
  expect(signUp.status).toBe(200)
  userA = (await signUp.json() as { user: { id: string } }).user.id

  // 2. Seed org + membership directly in DB (bypass org-plugin HTTP surface entirely).
  //    The owner orgMembers row satisfies the authed gate when oRPC reads activeOrganizationId.
  await db.insert(organizations).values({ id: orgA, name: 'IT Org', slug: `it-${orgA.slice(-8)}` })
  await db.insert(orgMembers).values({ id: memberA, userId: userA, orgId: orgA, role: 'owner' })

  // 3. Set session's activeOrganizationId directly in the DB — same effect as setActiveOrganization,
  //    avoids the adapter modelName lookup that doesn't resolve in test context.
  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, userA))

  // 4. employee_profile required by submitPunch (throws NOT_FOUND otherwise); superuser db bypasses RLS.
  const [p] = await db.insert(employeeProfile).values({ orgId: orgA, userId: userA }).returning({ id: employeeProfile.id })
  profileA = p!.id

  // RLS-leg fixtures: second tenant (direct inserts, mirrors punch.test.ts).
  await db.insert(organizations).values({ id: orgB, name: 'Org B', slug: `org-b-${orgB.slice(-8)}` })
  await db.insert(user).values({ id: userB, name: 'B', email: `${userB}@t.test` })
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB)) // no org members or profile — standalone tenant row
  await db.delete(organizations).where(eq(organizations.id, orgA)) // cascades the owner member row
  if (userA) await db.delete(user).where(eq(user.id, userA))       // cascades session/account
  await db.delete(user).where(eq(user.id, userB))
  await app.close()
})

describe('apps/api HTTP boundary', () => {
  it('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('Better Auth session -> oRPC time.punch.submit over HTTP writes a valid entry', async () => {
    const link = new RPCLink({ url: `${baseUrl}/api/v1/rpc`, headers: () => ({ cookie: cookieHeader() }) })
    const client: RouterClient<Router> = createORPCClient(link)
    const out = await client.time.punch.submit({
      clientUuid: randomUUID(),
      type: 'clock_in',
      source: 'in_app',
      capturedAtClient: new Date().toISOString(),
    })
    expect(out.status).toBe('valid')
    expect(out.entryId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('cross-tenant RLS denial: org B context cannot write org A data', async () => {
    await expect(
      withOrgCtx(db, { orgId: orgB, userId: userB, memberRole: 'employee' }, async (tx) => {
        await tx.insert(timeEntry).values({
          clientUuid: randomUUID(),
          orgId: orgA, // mismatched: app.org_id = orgB
          employeeId: profileA,
          type: 'clock_in',
          source: 'in_app',
          capturedAtClient: new Date(),
        })
      }),
    ).rejects.toMatchObject({ cause: { code: '42501' } })
  })
})
