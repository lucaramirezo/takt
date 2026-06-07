import { randomUUID } from 'node:crypto'
import { db, employeeProfile, orgMembers, organizations, timeEntry, user } from '@takt/db'
import { TimesheetGetOutput } from '@takt/domain'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getTimesheet } from '../services/timesheet'

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const ownerAUserId = `user_${randomUUID()}`
const emp1AUserId = `user_${randomUUID()}`
const emp2AUserId = `user_${randomUUID()}`
const noProfileUserId = `user_${randomUUID()}`
const userBUserId = `user_${randomUUID()}`

let emp1ProfileId = ''
let emp2ProfileId = ''
let userBProfileId = ''

const ctxOwnerA = () => ({ orgId: orgA, userId: ownerAUserId, memberRole: 'owner' })
const ctxEmp1A = () => ({ orgId: orgA, userId: emp1AUserId, memberRole: 'employee' })
const ctxNoProfile = () => ({ orgId: orgA, userId: noProfileUserId, memberRole: 'employee' })
const ctxB = () => ({ orgId: orgB, userId: userBUserId, memberRole: 'owner' })

beforeAll(async () => {
  await db.insert(organizations).values([
    { id: orgA, name: 'Timesheet Org A' },
    { id: orgB, name: 'Timesheet Org B' },
  ])
  await db.insert(user).values([
    { id: ownerAUserId, name: 'Owner A', email: `${ownerAUserId}@t.test` },
    { id: emp1AUserId, name: 'Emp One', email: `${emp1AUserId}@t.test` },
    { id: emp2AUserId, name: 'Emp Two', email: `${emp2AUserId}@t.test` },
    { id: noProfileUserId, name: 'No Profile', email: `${noProfileUserId}@t.test` },
    { id: userBUserId, name: 'User B', email: `${userBUserId}@t.test` },
  ])
  await db.insert(orgMembers).values([
    { id: `member_${randomUUID()}`, orgId: orgA, userId: ownerAUserId, role: 'owner' },
    { id: `member_${randomUUID()}`, orgId: orgA, userId: emp1AUserId, role: 'employee' },
    { id: `member_${randomUUID()}`, orgId: orgA, userId: emp2AUserId, role: 'employee' },
    { id: `member_${randomUUID()}`, orgId: orgA, userId: noProfileUserId, role: 'employee' },
    { id: `member_${randomUUID()}`, orgId: orgB, userId: userBUserId, role: 'owner' },
  ])
  const profiles = await db
    .insert(employeeProfile)
    .values([
      { orgId: orgA, userId: emp1AUserId, employmentType: 'hourly' },
      { orgId: orgA, userId: emp2AUserId, employmentType: 'hourly' },
      { orgId: orgB, userId: userBUserId, employmentType: 'contractor' },
    ])
    .returning({ id: employeeProfile.id, userId: employeeProfile.userId })
  emp1ProfileId = profiles.find((p) => p.userId === emp1AUserId)!.id
  emp2ProfileId = profiles.find((p) => p.userId === emp2AUserId)!.id
  userBProfileId = profiles.find((p) => p.userId === userBUserId)!.id

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

  // emp1A: 4 valid rows (clock_in, break_start, break_end, clock_out)
  await db.insert(timeEntry).values([
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'break_start', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'break_end', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'clock_out', source: 'in_app', capturedAtClient: now },
  ])
  // emp1A: one flagged row (must be excluded)
  await db.insert(timeEntry).values({
    clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'clock_in', source: 'in_app',
    capturedAtClient: now, status: 'flagged',
  })
  // emp1A: one row 30 days ago (must be excluded by default window)
  await db.insert(timeEntry).values({
    clientUuid: randomUUID(), orgId: orgA, employeeId: emp1ProfileId, type: 'clock_in', source: 'in_app',
    capturedAtClient: thirtyDaysAgo, recordedAtServer: thirtyDaysAgo,
  })
  // emp2A: 2 valid rows
  await db.insert(timeEntry).values([
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp2ProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgA, employeeId: emp2ProfileId, type: 'clock_out', source: 'in_app', capturedAtClient: now },
  ])
  // userB (orgB): cross-tenant negative target
  await db.insert(timeEntry).values([
    { clientUuid: randomUUID(), orgId: orgB, employeeId: userBProfileId, type: 'clock_in', source: 'in_app', capturedAtClient: now },
    { clientUuid: randomUUID(), orgId: orgB, employeeId: userBProfileId, type: 'clock_out', source: 'in_app', capturedAtClient: now },
  ])
})

afterAll(async () => {
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgA))
  await db.delete(timeEntry).where(eq(timeEntry.orgId, orgB))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgA))
  await db.delete(employeeProfile).where(eq(employeeProfile.orgId, orgB))
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgA))
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgB))
  await db.delete(user).where(inArray(user.id, [ownerAUserId, emp1AUserId, emp2AUserId, noProfileUserId, userBUserId]))
  await db.delete(organizations).where(eq(organizations.id, orgA))
  await db.delete(organizations).where(eq(organizations.id, orgB))
})

describe('getTimesheet', () => {
  it('owner: returns all-org valid entries within window; excludes flagged and 30-day-old row', async () => {
    const out = await getTimesheet(db, ctxOwnerA(), {})
    expect(out.entries.every((e) => e.status === 'valid')).toBe(true)
    expect(out.entries.some((e) => e.employeeId === emp1ProfileId)).toBe(true)
    expect(out.entries.some((e) => e.employeeId === emp2ProfileId)).toBe(true)
    // flagged and 30-day-old excluded: emp1 has 4 valid recent rows
    expect(out.entries.filter((e) => e.employeeId === emp1ProfileId).length).toBe(4)
  })

  it('owner: all entries have status valid (status filter)', async () => {
    const out = await getTimesheet(db, ctxOwnerA(), {})
    expect(out.entries.every((e) => e.status === 'valid')).toBe(true)
  })

  it('employee (emp1A): returns only own entries (self-scope)', async () => {
    const out = await getTimesheet(db, ctxEmp1A(), {})
    expect(out.entries.length).toBeGreaterThan(0)
    expect(out.entries.every((e) => e.employeeId === emp1ProfileId)).toBe(true)
  })

  it('employee with no profile: throws NOT_FOUND', async () => {
    await expect(getTimesheet(db, ctxNoProfile(), {})).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('admin employeeId filter: returns only specified employee rows', async () => {
    const out = await getTimesheet(db, ctxOwnerA(), { employeeId: emp2ProfileId })
    expect(out.entries.length).toBeGreaterThan(0)
    expect(out.entries.every((e) => e.employeeId === emp2ProfileId)).toBe(true)
  })

  it('cross-tenant: ctxB sees only orgB rows (both sides)', async () => {
    const out = await getTimesheet(db, ctxB(), {})
    expect(out.entries.some((e) => e.employeeId === userBProfileId)).toBe(true)
    expect(out.entries.every((e) => e.employeeId !== emp1ProfileId)).toBe(true)
  })

  it('output shape: TimesheetGetOutput.parse succeeds and entry key-set is correct', async () => {
    const out = await getTimesheet(db, ctxOwnerA(), {})
    expect(() => TimesheetGetOutput.parse(out)).not.toThrow()
    const expectedKeys = ['capturedAtClient', 'employeeId', 'employeeName', 'id', 'inZone', 'recordedAtServer', 'source', 'status', 'type'].sort()
    expect(Object.keys(out.entries[0]!).sort()).toEqual(expectedKeys)
    for (const e of out.entries) {
      expect(Number.isNaN(Date.parse(e.recordedAtServer))).toBe(false)
      expect(Number.isNaN(Date.parse(e.capturedAtClient))).toBe(false)
    }
  })

  it('employees list: owner gets >= 2 employees; employee gets exactly self', async () => {
    const ownerOut = await getTimesheet(db, ctxOwnerA(), {})
    expect(ownerOut.employees.length).toBeGreaterThanOrEqual(2)
    expect(ownerOut.employees.some((e) => e.employeeId === emp1ProfileId)).toBe(true)
    expect(ownerOut.employees.some((e) => e.employeeId === emp2ProfileId)).toBe(true)

    const empOut = await getTimesheet(db, ctxEmp1A(), {})
    expect(empOut.employees.length).toBe(1)
    expect(empOut.employees[0]!.employeeId).toBe(emp1ProfileId)
  })
})
