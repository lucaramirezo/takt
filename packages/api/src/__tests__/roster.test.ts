import { randomUUID } from 'node:crypto'
import { db, employeeProfile, orgMembers, organizations, user } from '@takt/db'
import { MeOutput, RosterOutput } from '@takt/domain'
import { roleCan } from '@takt/auth'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getRoster } from '../services/org'

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const ownerA = `user_${randomUUID()}`
const managerA = `user_${randomUUID()}`
const employeeA = `user_${randomUUID()}`
const noProfileA = `user_${randomUUID()}`
const userB = `user_${randomUUID()}`

const memberOwnerA = `member_${randomUUID()}`
const memberManagerA = `member_${randomUUID()}`
const memberEmployeeA = `member_${randomUUID()}`
const memberNoProfileA = `member_${randomUUID()}`
const memberB = `member_${randomUUID()}`

const ctxOwnerA = () => ({ orgId: orgA, userId: ownerA, memberRole: 'owner' })
const ctxB = () => ({ orgId: orgB, userId: userB, memberRole: 'owner' })

beforeAll(async () => {
  await db.insert(organizations).values([{ id: orgA, name: 'Org A' }, { id: orgB, name: 'Org B' }])
  await db.insert(user).values([
    { id: ownerA, name: 'Alice Owner', email: `${ownerA}@t.test` },
    { id: managerA, name: 'Bob Manager', email: `${managerA}@t.test` },
    { id: employeeA, name: 'Carol Employee', email: `${employeeA}@t.test` },
    { id: noProfileA, name: 'Dave NoProfile', email: `${noProfileA}@t.test` },
    { id: userB, name: 'Eve OrgB', email: `${userB}@t.test` },
  ])
  await db.insert(orgMembers).values([
    { id: memberOwnerA, orgId: orgA, userId: ownerA, role: 'owner' },
    { id: memberManagerA, orgId: orgA, userId: managerA, role: 'manager' },
    { id: memberEmployeeA, orgId: orgA, userId: employeeA, role: 'employee' },
    { id: memberNoProfileA, orgId: orgA, userId: noProfileA, role: 'employee' },
    { id: memberB, orgId: orgB, userId: userB, role: 'owner' },
  ])
  await db.insert(employeeProfile).values([
    { orgId: orgA, userId: ownerA, employmentType: 'salaried' },
    { orgId: orgA, userId: managerA, employmentType: 'salaried' },
    { orgId: orgA, userId: employeeA, employmentType: 'hourly' },
    { orgId: orgB, userId: userB, employmentType: 'contractor' },
  ])
  // noProfileA intentionally has no employeeProfile row
})

afterAll(async () => {
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgA))
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgB))
  await db.delete(user).where(eq(user.id, ownerA))
  await db.delete(user).where(eq(user.id, managerA))
  await db.delete(user).where(eq(user.id, employeeA))
  await db.delete(user).where(eq(user.id, noProfileA))
  await db.delete(user).where(eq(user.id, userB))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
})

describe('permission gate (roleCan predicate)', () => {
  it('employee cannot read employee list', () => {
    expect(roleCan('employee', 'employee', 'read')).toBe(false)
  })
  it('owner can read employee list', () => {
    expect(roleCan('owner', 'employee', 'read')).toBe(true)
  })
  it('manager can read employee list', () => {
    expect(roleCan('manager', 'employee', 'read')).toBe(true)
  })
  it('people_manager can read employee list', () => {
    expect(roleCan('people_manager', 'employee', 'read')).toBe(true)
  })
})

describe('getRoster', () => {
  it('returns all org-A members for owner', async () => {
    const rows = await getRoster(db, ctxOwnerA())
    expect(rows.length).toBe(4)
  })

  it('LEFT join: no-profile member appears with null profile fields', async () => {
    const rows = await getRoster(db, ctxOwnerA())
    const dave = rows.find((r) => r.userId === noProfileA)
    expect(dave).toBeDefined()
    expect(dave!.employeeProfileId).toBeNull()
    expect(dave!.employmentType).toBeNull()
    expect(dave!.active).toBeNull()
  })

  it('role passthrough: each returned role equals seeded org_members.role', async () => {
    const rows = await getRoster(db, ctxOwnerA())
    const owner = rows.find((r) => r.userId === ownerA)
    const manager = rows.find((r) => r.userId === managerA)
    const employee = rows.find((r) => r.userId === employeeA)
    expect(owner!.role).toBe('owner')
    expect(manager!.role).toBe('manager')
    expect(employee!.role).toBe('employee')
  })

  it('cross-tenant isolation: ctxB returns only org-B rows', async () => {
    const rows = await getRoster(db, ctxB())
    expect(rows.length).toBe(1)
    expect(rows[0]!.userId).toBe(userB)
  })

  it('output shape: RosterOutput.parse succeeds and has exactly 9 keys', async () => {
    const rows = await getRoster(db, ctxOwnerA())
    expect(() => RosterOutput.parse(rows)).not.toThrow()
    const expectedKeys = ['memberId', 'userId', 'name', 'email', 'role', 'employeeProfileId', 'employmentType', 'active', 'joinedAt']
    expect(Object.keys(rows[0]!).sort()).toEqual(expectedKeys.sort())
  })

  it('joinedAt is a valid ISO datetime string', async () => {
    const rows = await getRoster(db, ctxOwnerA())
    for (const r of rows) {
      expect(Number.isNaN(Date.parse(r.joinedAt))).toBe(false)
    }
  })
})

describe('MeOutput schema strictness', () => {
  it('rejects a bogus role', () => {
    expect(() => MeOutput.parse({ userId: 'u', orgId: 'o', role: 'bogus' })).toThrow()
  })
  it('accepts a valid role', () => {
    expect(() => MeOutput.parse({ userId: 'u', orgId: 'o', role: 'owner' })).not.toThrow()
  })
})
