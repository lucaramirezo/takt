'use client'

import type { TimesheetEmployee, TimesheetEntryRow } from '@takt/domain'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Session {
  clockIn: TimesheetEntryRow
  clockOut: TimesheetEntryRow | null
  breaks: Array<{ start: TimesheetEntryRow; end: TimesheetEntryRow | null }>
}

function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function TimesheetTable({
  entries,
  employees,
  range,
}: {
  entries: TimesheetEntryRow[]
  employees: TimesheetEmployee[]
  range: { from: string; to: string }
}) {
  // Browser-local zone. Future: resolve org-configured IANA zone here when org.timezone lands.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz })

  function dayKey(ts: string): string {
    return dayFmt.format(new Date(ts))
  }

  function fmtTime(ts: string): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })
  }

  const employeeMap = new Map(employees.map((e) => [e.employeeId, e.name]))

  type DayRow = {
    employeeId: string
    day: string
    firstIn: string
    lastOut: string | null
    netWorkedMs: number | null
    breakMs: number
    punchCount: number
  }

  const dayRows: DayRow[] = []

  const byEmployee = new Map<string, TimesheetEntryRow[]>()
  for (const e of entries) {
    const list = byEmployee.get(e.employeeId) ?? []
    list.push(e)
    byEmployee.set(e.employeeId, list)
  }

  for (const [employeeId, empEntries] of byEmployee) {
    const sorted = [...empEntries].sort(
      (a, b) => new Date(a.recordedAtServer).getTime() - new Date(b.recordedAtServer).getTime(),
    )

    // Pair sessions first on the full sorted stream before bucketing
    const sessions: Session[] = []
    let openSession: Session | null = null

    for (const entry of sorted) {
      if (entry.type === 'clock_in') {
        openSession = { clockIn: entry, clockOut: null, breaks: [] }
        sessions.push(openSession)
      } else if (entry.type === 'clock_out') {
        if (openSession) {
          openSession.clockOut = entry
          openSession = null
        } else {
          // Orphan clock_out: attach as its own session with no clock_in (skip display)
        }
      } else if (entry.type === 'break_start') {
        if (openSession) {
          openSession.breaks.push({ start: entry, end: null })
        }
      } else if (entry.type === 'break_end') {
        if (openSession && openSession.breaks.length > 0) {
          const lastBreak = openSession.breaks[openSession.breaks.length - 1]!
          if (!lastBreak.end) {
            lastBreak.end = entry
          }
        }
      }
    }

    // Bucket sessions by clock_in local day
    const dayMap = new Map<string, Session[]>()
    for (const s of sessions) {
      const day = dayKey(s.clockIn.recordedAtServer)
      const list = dayMap.get(day) ?? []
      list.push(s)
      dayMap.set(day, list)
    }

    for (const [day, daySessions] of dayMap) {
      let totalNetWorkedMs = 0
      let hasNull = false
      let totalBreakMs = 0
      let firstIn = daySessions[0]!.clockIn.recordedAtServer
      let lastOut: string | null = null
      const punchCount = empEntries.filter(
        (e) =>
          dayKey(e.recordedAtServer) === day &&
          (e.type === 'clock_in' || e.type === 'clock_out' || e.type === 'break_start' || e.type === 'break_end'),
      ).length

      for (const s of daySessions) {
        if (new Date(s.clockIn.recordedAtServer).getTime() < new Date(firstIn).getTime()) {
          firstIn = s.clockIn.recordedAtServer
        }
        if (s.clockOut) {
          if (!lastOut || new Date(s.clockOut.recordedAtServer).getTime() > new Date(lastOut).getTime()) {
            lastOut = s.clockOut.recordedAtServer
          }
        }
        const breakMs = s.breaks.reduce((acc, b) => {
          if (!b.end) return acc
          return acc + (new Date(b.end.recordedAtServer).getTime() - new Date(b.start.recordedAtServer).getTime())
        }, 0)
        totalBreakMs += breakMs
        if (s.clockOut) {
          const durationMs = new Date(s.clockOut.recordedAtServer).getTime() - new Date(s.clockIn.recordedAtServer).getTime()
          totalNetWorkedMs += Math.max(0, durationMs - breakMs)
        } else {
          hasNull = true
        }
      }

      dayRows.push({
        employeeId,
        day,
        firstIn,
        lastOut,
        netWorkedMs: hasNull ? null : totalNetWorkedMs,
        breakMs: totalBreakMs,
        punchCount,
      })
    }
  }

  // Sort by day desc, then name asc
  dayRows.sort((a, b) => {
    if (b.day !== a.day) return b.day.localeCompare(a.day)
    const nameA = employeeMap.get(a.employeeId) ?? ''
    const nameB = employeeMap.get(b.employeeId) ?? ''
    return nameA.localeCompare(nameB)
  })

  const _range = range // available for future use

  if (entries.length === 0) {
    return (
      <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
        No recorded punches in this range.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Worker</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>First in</TableHead>
          <TableHead>Last out</TableHead>
          <TableHead className="text-right">Worked</TableHead>
          <TableHead className="text-right">Break</TableHead>
          <TableHead className="text-right">Punches</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dayRows.map((row) => (
          <TableRow key={`${row.employeeId}-${row.day}`}>
            <TableCell className="font-medium">{employeeMap.get(row.employeeId) ?? row.employeeId}</TableCell>
            <TableCell className="font-mono tabular-nums">{row.day}</TableCell>
            <TableCell className="font-mono tabular-nums">{fmtTime(row.firstIn)}</TableCell>
            <TableCell className="font-mono tabular-nums">
              {row.lastOut ? fmtTime(row.lastOut) : <span className="text-muted-foreground">--</span>}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.netWorkedMs !== null ? fmtDuration(row.netWorkedMs) : <span className="text-muted-foreground">--</span>}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {row.breakMs > 0 ? fmtDuration(row.breakMs) : <span className="text-muted-foreground">--</span>}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{row.punchCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
