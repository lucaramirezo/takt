import { randomUUID } from 'node:crypto'
import { db, employeeProfile, organizations, timeEntry, user } from '@takt/db'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPunchStatus, submitPunch } from '../services/punch'

const orgA = `org_${randomUUID()}`
const orgB = `org_${randomUUID()}`
const userA = `user_${randomUUID()}`
const userB = `user_${randomUUID()}`
let _profileA = ''
let _profileB = ''
const ctxA = () => ({ orgId: orgA, userId: userA, memberRole: 'employee' })
const ctxB = () => ({ orgId: orgB, userId: userB, memberRole: 'employee' })

function punch(type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') {
  return { clientUuid: randomUUID(), type, source: 'in_app' as const, capturedAtClient: new Date().toISOString() }
}

beforeAll(async () => {
  await db.insert(organizations).values([{ id: orgA, name: 'Org A' }, { id: orgB, name: 'Org B' }])
  await db.insert(user).values([
    { id: userA, name: 'A', email: `${userA}@t.test` },
    { id: userB, name: 'B', email: `${userB}@t.test` },
  ])
  const [pa] = await db.insert(employeeProfile).values({ orgId: orgA, userId: userA }).returning({ id: employeeProfile.id })
  const [pb] = await db.insert(employeeProfile).values({ orgId: orgB, userId: userB }).returning({ id: employeeProfile.id })
  _profileA = pa!.id
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

describe('getPunchStatus', () => {
  it('no entries -> clocked_out', async () => {
    const s = await getPunchStatus(db, ctxA())
    expect(s).toEqual({ state: 'clocked_out', since: null, lastEntryType: null })
  })
  it('walks the state machine in_app: in -> break -> back -> out', async () => {
    await submitPunch(db, ctxA(), punch('clock_in') as never)
    let s = await getPunchStatus(db, ctxA())
    expect(s.state).toBe('clocked_in'); expect(s.lastEntryType).toBe('clock_in')
    expect(Number.isNaN(Date.parse(s.since!))).toBe(false)
    await submitPunch(db, ctxA(), punch('break_start') as never)
    s = await getPunchStatus(db, ctxA()); expect(s.state).toBe('on_break')
    await submitPunch(db, ctxA(), punch('break_end') as never)
    s = await getPunchStatus(db, ctxA()); expect(s.state).toBe('clocked_in')
    await submitPunch(db, ctxA(), punch('clock_out') as never)
    s = await getPunchStatus(db, ctxA()); expect(s.state).toBe('clocked_out')
  })
  it('org isolation: org B does not see org A entries', async () => {
    await submitPunch(db, ctxA(), punch('clock_in') as never)
    const s = await getPunchStatus(db, ctxB())
    expect(s.state).toBe('clocked_out')
  })
})
