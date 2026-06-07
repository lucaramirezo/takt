'use client'

import * as React from 'react'
import type { TimesheetEmployee } from '@takt/domain'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
]

function detectPresetDays(from: string, to: string): string {
  const diffDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 3600 * 1000))
  const match = PRESETS.find((p) => p.days === diffDays)
  return match ? String(match.days) : '14'
}

export function TimesheetRangeSelect({
  employees,
  selectedEmployeeId,
}: {
  employees: TimesheetEmployee[]
  selectedEmployeeId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleRangeChange(days: string) {
    const to = new Date()
    const from = new Date(Date.now() - Number(days) * 24 * 3600 * 1000)
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', from.toISOString())
    params.set('to', to.toISOString())
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleEmployeeChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '__all__') {
      params.delete('employeeId')
    } else {
      params.set('employeeId', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const currentDays =
    searchParams.get('from') && searchParams.get('to')
      ? detectPresetDays(searchParams.get('from')!, searchParams.get('to')!)
      : '14'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select onValueChange={handleRangeChange} value={currentDays}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.days} value={String(p.days)}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {employees.length > 1 && (
        <Select onValueChange={handleEmployeeChange} value={selectedEmployeeId ?? '__all__'}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All workers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All workers</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.employeeId} value={e.employeeId}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
