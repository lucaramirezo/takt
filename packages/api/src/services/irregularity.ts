import { type Database, type OrgCtx, employeeProfile, timeEntry, user, withOrgCtx } from '@takt/db'
import { type IrregularityListInput, type IrregularityListOutput, type IrregularityRow, ORG_DISPLAY_TZ } from '@takt/domain'
import { and, asc, eq, gte, lte } from 'drizzle-orm'

const OVERTIME_MS = 9 * 60 * 60 * 1000 // daily worked threshold

// Bucket days in the shared org zone (NOT UTC) so the inbox and the timesheet agree on the calendar day.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: ORG_DISPLAY_TZ })
const dayKey = (d: Date): string => dayFmt.format(d)

interface RawRow {
  id: string
  employeeId: string
  employeeName: string
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  recordedAtServer: Date
  inZone: boolean | null
}

interface Session {
  clockIn: RawRow
  clockOut: RawRow | null
  breaks: Array<{ start: RawRow; end: RawRow | null }>
}

/**
 * Detect exceptions over the append-only punch stream: out-of-zone flags (real, written by remote
 * geofence eval), missing clock-out (open session from a prior day), and daily overtime (>9h worked).
 * Read-only and derived: nothing is persisted. Day bucketing is UTC (org IANA zone is future work).
 */
export async function getIrregularities(
  db: Database,
  ctx: OrgCtx,
  input: IrregularityListInput,
): Promise<IrregularityListOutput> {
  const now = new Date()
  const toDate = input.to ? new Date(input.to) : now
  const fromDate = input.from ? new Date(input.from) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const today = dayKey(now)

  return withOrgCtx(db, ctx, async (tx) => {
    const rows: RawRow[] = await tx
      .select({
        id: timeEntry.id,
        employeeId: timeEntry.employeeId,
        employeeName: user.name,
        type: timeEntry.type,
        recordedAtServer: timeEntry.recordedAtServer,
        inZone: timeEntry.inZone,
      })
      .from(timeEntry)
      .innerJoin(employeeProfile, eq(employeeProfile.id, timeEntry.employeeId))
      .innerJoin(user, eq(user.id, employeeProfile.userId))
      .where(
        and(
          eq(timeEntry.orgId, ctx.orgId),
          gte(timeEntry.recordedAtServer, fromDate),
          lte(timeEntry.recordedAtServer, toDate),
        ),
      )
      .orderBy(asc(timeEntry.employeeId), asc(timeEntry.recordedAtServer))

    const byEmployee = new Map<string, RawRow[]>()
    for (const r of rows) {
      const list = byEmployee.get(r.employeeId) ?? []
      list.push(r)
      byEmployee.set(r.employeeId, list)
    }

    const out: IrregularityRow[] = []

    for (const [employeeId, list] of byEmployee) {
      const employeeName = list[0]?.employeeName ?? employeeId

      // out_of_zone: any entry the server marked outside its geofence (in_zone === false).
      for (const r of list) {
        if (r.inZone === false) {
          const iso = r.recordedAtServer.toISOString()
          out.push({
            id: `oz:${r.id}`,
            type: 'out_of_zone',
            severity: 'high',
            employeeId,
            employeeName,
            day: dayKey(r.recordedAtServer),
            at: iso,
            detail: 'Punch recorded outside the assigned geofence',
          })
        }
      }

      // Pair sessions across the full per-employee stream.
      const sessions: Session[] = []
      let open: Session | null = null
      for (const r of list) {
        if (r.type === 'clock_in') {
          open = { clockIn: r, clockOut: null, breaks: [] }
          sessions.push(open)
        } else if (r.type === 'clock_out') {
          if (open) {
            open.clockOut = r
            open = null
          }
        } else if (r.type === 'break_start') {
          if (open) open.breaks.push({ start: r, end: null })
        } else if (r.type === 'break_end') {
          const lastBreak = open?.breaks[open.breaks.length - 1]
          if (lastBreak && !lastBreak.end) lastBreak.end = r
        }
      }

      // missing_clock_out: an open session whose clock_in day is before today.
      for (const s of sessions) {
        if (s.clockOut) continue
        const iso = s.clockIn.recordedAtServer.toISOString()
        const day = dayKey(s.clockIn.recordedAtServer)
        if (day < today) {
          out.push({
            id: `mco:${s.clockIn.id}`,
            type: 'missing_clock_out',
            severity: 'high',
            employeeId,
            employeeName,
            day,
            at: iso,
            detail: 'Clock-in with no clock-out',
          })
        }
      }

      // overtime: net worked per UTC day across closed sessions exceeds the threshold.
      const dayWorkedMs = new Map<string, number>()
      const dayLastOut = new Map<string, string>()
      for (const s of sessions) {
        if (!s.clockOut) continue
        const inMs = s.clockIn.recordedAtServer.getTime()
        const outMs = s.clockOut.recordedAtServer.getTime()
        const breakMs = s.breaks.reduce(
          (acc, b) => (b.end ? acc + (b.end.recordedAtServer.getTime() - b.start.recordedAtServer.getTime()) : acc),
          0,
        )
        const day = dayKey(s.clockIn.recordedAtServer)
        dayWorkedMs.set(day, (dayWorkedMs.get(day) ?? 0) + Math.max(0, outMs - inMs - breakMs))
        dayLastOut.set(day, s.clockOut.recordedAtServer.toISOString())
      }
      for (const [day, ms] of dayWorkedMs) {
        if (ms > OVERTIME_MS) {
          const h = Math.floor(ms / 3600000)
          const m = Math.floor((ms % 3600000) / 60000)
          out.push({
            id: `ot:${employeeId}:${day}`,
            type: 'overtime',
            severity: 'medium',
            employeeId,
            employeeName,
            day,
            at: dayLastOut.get(day) ?? null,
            detail: `Worked ${h}h ${String(m).padStart(2, '0')}m (over 9h)`,
          })
        }
      }
    }

    const sevRank = { high: 0, medium: 1, low: 2 }
    out.sort(
      (a, b) =>
        sevRank[a.severity] - sevRank[b.severity] ||
        b.day.localeCompare(a.day) ||
        a.employeeName.localeCompare(b.employeeName),
    )

    const counts = {
      high: out.filter((x) => x.severity === 'high').length,
      medium: out.filter((x) => x.severity === 'medium').length,
      low: out.filter((x) => x.severity === 'low').length,
      total: out.length,
    }

    return { irregularities: out, range: { from: fromDate.toISOString(), to: toDate.toISOString() }, counts }
  })
}
