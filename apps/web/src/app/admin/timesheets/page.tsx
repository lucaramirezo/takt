import { redirect } from 'next/navigation'
import { serverClient } from '@/lib/orpc-server'
import { TimesheetRangeSelect } from '@/components/admin/timesheet-range-select'
import { TimesheetTable } from '@/components/admin/timesheet-table'

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; employeeId?: string }>
}) {
  let me: Awaited<ReturnType<typeof serverClient.me>>
  try {
    me = await serverClient.me()
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') redirect('/login')
    throw err
  }
  if (me.role === 'employee') redirect('/clock')

  const sp = await searchParams
  const data = await serverClient.time.timesheet.get({
    from: sp.from || undefined,
    to: sp.to || undefined,
    employeeId: sp.employeeId || undefined,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Timesheets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recorded hours, not payroll</p>
        </div>
      </header>
      <TimesheetRangeSelect employees={data.employees} selectedEmployeeId={sp.employeeId} />
      <TimesheetTable entries={data.entries} employees={data.employees} range={data.range} />
    </div>
  )
}
