'use client'

import { CheckCircle, Clock, MapPinLine, Timer, WarningCircle } from '@phosphor-icons/react'
import type { IrregularityRow, IrregularityType } from '@takt/domain'
import { type ComponentType, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

const TYPE_META: Record<IrregularityType, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  out_of_zone: { label: 'Out of zone', Icon: MapPinLine },
  missing_clock_out: { label: 'Missing clock-out', Icon: Clock },
  overtime: { label: 'Overtime', Icon: Timer },
}

function severityColor(severity: IrregularityRow['severity']): string {
  return severity === 'high' ? 'var(--danger)' : severity === 'medium' ? 'var(--warning)' : 'var(--muted-foreground)'
}

const FILTERS: Array<{ key: 'all' | IrregularityType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'out_of_zone', label: 'Out of zone' },
  { key: 'missing_clock_out', label: 'Missing clock-out' },
  { key: 'overtime', label: 'Overtime' },
]

export function ExceptionsInbox({
  irregularities,
  counts,
}: {
  irregularities: IrregularityRow[]
  counts: { high: number; medium: number; low: number; total: number }
}) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | IrregularityType>('all')

  const open = useMemo(() => irregularities.filter((i) => !acknowledged.has(i.id)), [irregularities, acknowledged])
  const visible = useMemo(
    () => (filter === 'all' ? open : open.filter((i) => i.type === filter)),
    [open, filter],
  )
  const openHigh = open.filter((i) => i.severity === 'high').length
  const openMedium = open.filter((i) => i.severity === 'medium').length

  function fmtTime(at: string | null): string {
    return at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Severity summary */}
      <div className="flex flex-wrap items-center gap-2">
        <SummaryChip color="var(--danger)" count={openHigh} label="high" />
        <SummaryChip color="var(--warning)" count={openMedium} label="medium" />
        <span className="ml-1 text-sm text-muted-foreground">
          {open.length} open of {counts.total} detected
        </span>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={{
              borderColor: filter === f.key ? 'var(--foreground)' : 'var(--border)',
              background: filter === f.key ? 'var(--foreground)' : 'transparent',
              color: filter === f.key ? 'var(--background)' : 'var(--muted-foreground)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border px-4 py-12 text-center">
          <CheckCircle className="size-7" style={{ color: 'var(--success)' }} weight="fill" />
          <p className="text-sm text-muted-foreground">
            {open.length === 0 ? 'No open exceptions. Everything looks clean.' : 'No exceptions match this filter.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((ex) => {
            const meta = TYPE_META[ex.type]
            const color = severityColor(ex.severity)
            return (
              <li
                key={ex.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-4"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
                >
                  <meta.Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{meta.label}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                      style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
                    >
                      {ex.severity}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {ex.employeeName} · {ex.detail}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right font-mono text-xs text-muted-foreground sm:block">
                  <div className="tabular-nums">{ex.day}</div>
                  {ex.at && <div className="tabular-nums">{fmtTime(ex.at)}</div>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAcknowledged((prev) => new Set(prev).add(ex.id))}
                >
                  Acknowledge
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {acknowledged.size > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WarningCircle className="size-3.5" />
          {acknowledged.size} acknowledged this session (acknowledgement is not yet persisted)
        </p>
      )}
    </div>
  )
}

function SummaryChip({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
    >
      <span className="font-mono tabular-nums">{count}</span> {label}
    </span>
  )
}
