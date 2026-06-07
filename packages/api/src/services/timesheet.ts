import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, employeeProfile, timeEntry, user, withOrgCtx } from '@takt/db'
import type { TimesheetGetInput, TimesheetGetOutput } from '@takt/domain'
import { and, asc, eq, gte, lte } from 'drizzle-orm'

export async function getTimesheet(db: Database, ctx: OrgCtx, input: TimesheetGetInput): Promise<TimesheetGetOutput> {
  const now = new Date()
  const toDate = input.to ? new Date(input.to) : now
  const fromDate = input.from ? new Date(input.from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  return withOrgCtx(db, ctx, async (tx) => {
    const isEmployee = ctx.memberRole === 'employee'
    let scopedEmployeeId: string | undefined

    if (isEmployee) {
      const [profile] = await tx
        .select({ id: employeeProfile.id })
        .from(employeeProfile)
        .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
        .limit(1)
      if (!profile) throw new ORPCError('NOT_FOUND', { message: 'No employee profile for this user in the active organization' })
      scopedEmployeeId = profile.id
    }

    const conditions = [
      eq(timeEntry.orgId, ctx.orgId),
      eq(timeEntry.status, 'valid'),
      gte(timeEntry.recordedAtServer, fromDate),
      lte(timeEntry.recordedAtServer, toDate),
      ...(isEmployee && scopedEmployeeId ? [eq(timeEntry.employeeId, scopedEmployeeId)] : []),
      ...(!isEmployee && input.employeeId ? [eq(timeEntry.employeeId, input.employeeId)] : []),
    ]

    const rawEntries = await tx
      .select({
        id: timeEntry.id,
        employeeId: timeEntry.employeeId,
        employeeName: user.name,
        type: timeEntry.type,
        source: timeEntry.source,
        capturedAtClient: timeEntry.capturedAtClient,
        recordedAtServer: timeEntry.recordedAtServer,
        status: timeEntry.status,
        inZone: timeEntry.inZone,
      })
      .from(timeEntry)
      .innerJoin(employeeProfile, eq(employeeProfile.id, timeEntry.employeeId))
      .innerJoin(user, eq(user.id, employeeProfile.userId))
      .where(and(...conditions))
      .orderBy(asc(timeEntry.recordedAtServer), asc(timeEntry.employeeId))

    const employees = await tx
      .select({ employeeId: employeeProfile.id, name: user.name })
      .from(employeeProfile)
      .innerJoin(user, eq(user.id, employeeProfile.userId))
      .where(
        and(
          eq(employeeProfile.orgId, ctx.orgId),
          isEmployee ? eq(employeeProfile.userId, ctx.userId) : undefined,
        ),
      )
      .orderBy(asc(user.name))

    const entries = rawEntries.map((e) => ({
      ...e,
      capturedAtClient: e.capturedAtClient.toISOString(),
      recordedAtServer: e.recordedAtServer.toISOString(),
      inZone: e.inZone ?? null,
    }))

    return {
      entries,
      employees,
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
    }
  })
}
