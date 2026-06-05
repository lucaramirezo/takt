'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { client } from '@/lib/orpc'

type Status = Awaited<ReturnType<typeof client.time.punch.status>>
type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

export default function ClockPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await client.time.punch.status())
      setError(null)
    } catch (err) {
      const code = (err as { code?: string }).code
      const httpStatus = (err as { status?: number }).status
      if (code === 'UNAUTHORIZED' || httpStatus === 401) { router.push('/login'); return }
      setError(err instanceof Error ? err.message : 'Failed to load status')
    }
  }, [router])

  useEffect(() => { void loadStatus() }, [loadStatus])

  async function punch(type: PunchType) {
    setBusy(true); setError(null)
    try {
      await client.time.punch.submit({
        clientUuid: crypto.randomUUID(),
        type,
        source: 'in_app',
        capturedAtClient: new Date().toISOString(),
      })
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Punch failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Clock<span style={{ color: 'var(--primary)' }}>.</span>
        </h1>
        {status && (
          <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            State:{' '}
            <span style={{ color: status.state === 'clocked_in' ? 'var(--success)' : 'var(--foreground)' }}>
              {status.state.replace('_', ' ')}
            </span>
            {status.since && (
              <>
                {' · since '}
                <time style={{ fontFamily: 'var(--font-mono)' }}>{new Date(status.since).toLocaleTimeString()}</time>
              </>
            )}
          </p>
        )}
      </header>

      {!status && !error && <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading...</p>}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="flex flex-col gap-3">
        {status?.state === 'clocked_out' && (
          <Button onClick={() => punch('clock_in')} disabled={busy} size="lg" className="min-h-14">
            Clock in
          </Button>
        )}
        {status?.state === 'clocked_in' && (
          <>
            <Button onClick={() => punch('break_start')} disabled={busy} variant="secondary" size="lg" className="min-h-14">
              Start break
            </Button>
            <Button onClick={() => punch('clock_out')} disabled={busy} variant="outline" size="lg" className="min-h-14"
              style={{ color: 'var(--danger)' }}>
              Clock out
            </Button>
          </>
        )}
        {status?.state === 'on_break' && (
          <Button onClick={() => punch('break_end')} disabled={busy} size="lg" className="min-h-14">
            End break
          </Button>
        )}
      </div>
    </main>
  )
}
