import { randomUUID } from 'node:crypto'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'
import { auditLog, db, employeeProfile, orgMembers, organizations, session, user } from '@takt/db'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

const AUTH_ORIGIN = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

let app: FastifyInstance
let baseUrl = ''

// Per-user cookie jars
const ownerACookies = new Map<string, string>()
const pmACookies = new Map<string, string>()
const mgrACookies = new Map<string, string>()

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

// Org and user IDs
const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`

let userOwnerA = ''
let memberOwnerA = ''
let userPmA = ''
let _memberPmA = ''
let userMgrA = ''
let _memberMgrA = ''

// Direct-seeded targets in orgA (no session; used as mutation targets)
const targetEmp1UserId = `user_${randomUUID()}`
const targetEmp1MemberId = `member_${randomUUID()}`
const targetEmp2UserId = `user_${randomUUID()}`
const targetEmp2MemberId = `member_${randomUUID()}`
const targetEmp3UserId = `user_${randomUUID()}`
const targetEmp3MemberId = `member_${randomUUID()}`

// OrgB standalone member for cross-org test
const userBId = `user_${randomUUID()}`
const memberBId = `member_${randomUUID()}`

// Disposable user email for duplicate-email test
const existingEmail = `existing_${randomUUID()}@takt.test`
let existingUserId = ''

// Captured from the happy-path create test; cleaned up in afterAll
let createdEmployeeUserId = ''

beforeAll(async () => {
  app = buildApp()
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

  // Sign up the three session-holding users
  userOwnerA = await signUp(ownerACookies, `owner_${randomUUID()}@takt.test`, 'Owner A')
  userPmA = await signUp(pmACookies, `pm_${randomUUID()}@takt.test`, 'PM A')
  userMgrA = await signUp(mgrACookies, `mgr_${randomUUID()}@takt.test`, 'Mgr A')

  // Seed orgA
  await db.insert(organizations).values({ id: orgA, name: 'Emp Mgmt Org', slug: `emp-mgmt-${orgA.slice(-8)}` })

  // Seed memberships for the three session users
  memberOwnerA = `member_${randomUUID()}`
  await db.insert(orgMembers).values({ id: memberOwnerA, userId: userOwnerA, orgId: orgA, role: 'owner' })
  _memberPmA = `member_${randomUUID()}`
  await db.insert(orgMembers).values({ id: _memberPmA, userId: userPmA, orgId: orgA, role: 'people_manager' })
  _memberMgrA = `member_${randomUUID()}`
  await db.insert(orgMembers).values({ id: _memberMgrA, userId: userMgrA, orgId: orgA, role: 'manager' })

  // Activate sessions against orgA
  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, userOwnerA))
  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, userPmA))
  await db.update(session).set({ activeOrganizationId: orgA }).where(eq(session.userId, userMgrA))

  // Direct-seed three target employees in orgA (no session needed)
  await db.insert(user).values([
    { id: targetEmp1UserId, name: 'Target Emp 1', email: `target1_${randomUUID()}@takt.test` },
    { id: targetEmp2UserId, name: 'Target Emp 2', email: `target2_${randomUUID()}@takt.test` },
    { id: targetEmp3UserId, name: 'Target Emp 3', email: `target3_${randomUUID()}@takt.test` },
  ])
  await db.insert(orgMembers).values([
    { id: targetEmp1MemberId, userId: targetEmp1UserId, orgId: orgA, role: 'employee' },
    { id: targetEmp2MemberId, userId: targetEmp2UserId, orgId: orgA, role: 'employee' },
    { id: targetEmp3MemberId, userId: targetEmp3UserId, orgId: orgA, role: 'employee' },
  ])

  // Seed orgB with one member (no session)
  await db.insert(organizations).values({ id: orgB, name: 'Org B', slug: `org-b-${orgB.slice(-8)}` })
  await db.insert(user).values({ id: userBId, name: 'User B', email: `userb_${randomUUID()}@takt.test` })
  await db.insert(orgMembers).values({ id: memberBId, userId: userBId, orgId: orgB, role: 'employee' })

  // Seed a user with a known email for the duplicate-email test
  existingUserId = `user_${randomUUID()}`
  await db.insert(user).values({ id: existingUserId, name: 'Existing User', email: existingEmail })
})

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
  if (userOwnerA) await db.delete(user).where(eq(user.id, userOwnerA))
  if (userPmA) await db.delete(user).where(eq(user.id, userPmA))
  if (userMgrA) await db.delete(user).where(eq(user.id, userMgrA))
  await db.delete(user).where(eq(user.id, targetEmp1UserId))
  await db.delete(user).where(eq(user.id, targetEmp2UserId))
  await db.delete(user).where(eq(user.id, targetEmp3UserId))
  await db.delete(user).where(eq(user.id, userBId))
  if (existingUserId) await db.delete(user).where(eq(user.id, existingUserId))
  if (createdEmployeeUserId) await db.delete(user).where(eq(user.id, createdEmployeeUserId))
  await app.close()
})

describe('employee management via oRPC router', () => {
  describe('employee.create', () => {
    it('happy path: ownerA creates an employee (no email) -> synthetic email + three-row identity + audit', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      const out = await ownerClient.employee.create({
        name: 'New Worker',
        role: 'employee',
        employmentType: 'hourly',
      })
      createdEmployeeUserId = out.userId
      expect(out.userId).toMatch(/^user_/)
      expect(out.memberId).toMatch(/^member_/)
      expect(out.role).toBe('employee')

      // Assert synthetic email
      const [newUser] = await db.select({ email: user.email }).from(user).where(eq(user.id, out.userId))
      expect(newUser?.email).toMatch(/^worker-user_.+@workers\.takt\.local$/)

      // Assert orgMembers row exists in orgA with role employee
      const [newMember] = await db
        .select({ role: orgMembers.role, orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.id, out.memberId))
      expect(newMember?.role).toBe('employee')
      expect(newMember?.orgId).toBe(orgA)

      // Assert employeeProfile row exists
      const [profile] = await db
        .select({ id: employeeProfile.id })
        .from(employeeProfile)
        .where(eq(employeeProfile.id, out.employeeProfileId))
      expect(profile?.id).toBe(out.employeeProfileId)

      // Assert audit_log row
      const logs = await db
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgA), eq(auditLog.action, 'employee.create')))
      expect(logs.length).toBeGreaterThanOrEqual(1)
    })

    it('duplicate email -> CONFLICT', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      await expect(
        ownerClient.employee.create({
          name: 'Dup User',
          role: 'employee',
          employmentType: 'hourly',
          email: existingEmail,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('people_manager creates with role=owner -> FORBIDDEN (authority guard)', async () => {
      const pmClient = clientFor(cookiesFor(pmACookies))
      await expect(
        pmClient.employee.create({ name: 'Bad Owner', role: 'owner', employmentType: 'hourly' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('manager (no employee:manage) -> FORBIDDEN (permission gate)', async () => {
      const mgrClient = clientFor(cookiesFor(mgrACookies))
      await expect(
        mgrClient.employee.create({ name: 'Blocked', role: 'employee', employmentType: 'hourly' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('org.member.setRole', () => {
    it('happy path: ownerA sets targetEmp1 -> manager + audit', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      const out = await ownerClient.org.member.setRole({ memberId: targetEmp1MemberId, role: 'manager' })
      expect(out).toEqual({ memberId: targetEmp1MemberId, role: 'manager' })

      const [updated] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(eq(orgMembers.id, targetEmp1MemberId))
      expect(updated?.role).toBe('manager')

      const logs = await db
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgA), eq(auditLog.action, 'org.member.set_role')))
      expect(logs.length).toBeGreaterThanOrEqual(1)
    })

    it('people_manager sets targetEmp2 -> owner -> FORBIDDEN (owner-role guard)', async () => {
      const pmClient = clientFor(cookiesFor(pmACookies))
      await expect(
        pmClient.org.member.setRole({ memberId: targetEmp2MemberId, role: 'owner' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('ownerA demotes sole owner (self) -> CONFLICT (last-owner guard) + no state change', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      await expect(
        ownerClient.org.member.setRole({ memberId: memberOwnerA, role: 'manager' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })

      const [unchanged] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(eq(orgMembers.id, memberOwnerA))
      expect(unchanged?.role).toBe('owner')
    })

    it('ownerA targets memberB (orgB) -> NOT_FOUND (cross-org guard)', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      await expect(
        ownerClient.org.member.setRole({ memberId: memberBId, role: 'manager' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('manager (no employee:manage) -> FORBIDDEN (permission gate)', async () => {
      const mgrClient = clientFor(cookiesFor(mgrACookies))
      await expect(
        mgrClient.org.member.setRole({ memberId: targetEmp2MemberId, role: 'manager' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('people_manager allow-path: pmA sets targetEmp3 (employee) -> manager -> resolves + audit', async () => {
      const pmClient = clientFor(cookiesFor(pmACookies))
      const out = await pmClient.org.member.setRole({ memberId: targetEmp3MemberId, role: 'manager' })
      expect(out).toEqual({ memberId: targetEmp3MemberId, role: 'manager' })

      const [updated] = await db
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(eq(orgMembers.id, targetEmp3MemberId))
      expect(updated?.role).toBe('manager')

      const logs = await db
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgA), eq(auditLog.action, 'org.member.set_role')))
      expect(logs.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('tenant isolation', () => {
    it('org.roster() for ownerA returns own-org rows and excludes orgB rows', async () => {
      const ownerClient = clientFor(cookiesFor(ownerACookies))
      const rows = await ownerClient.org.roster()
      expect(rows.some((r) => r.userId === userOwnerA)).toBe(true)
      expect(rows.every((r) => r.userId !== userBId)).toBe(true)
    })
  })
})
