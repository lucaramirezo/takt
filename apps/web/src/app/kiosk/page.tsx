'use client'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import type { KioskRosterOutput } from '@takt/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clearDeviceToken, getDeviceToken, kioskClient, setDeviceToken } from '@/lib/orpc-kiosk'
import { useIdleTimer } from './use-idle-timer'
import { PinPad } from './pin-pad'
import { useWakeLock } from './use-wake-lock'

type RosterItem = KioskRosterOutput[number]

export default function KioskPage() {
  useWakeLock()

  const [token, setToken] = useState<string | null>(null)
  const [roster, setRoster] = useState<KioskRosterOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<RosterItem | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [enrollInput, setEnrollInput] = useState('')

  const loadRoster = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await kioskClient.time.punch.kioskRoster()
      setRoster(data)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'UNAUTHORIZED') {
        clearDeviceToken()
        setToken(null)
        setRoster(null)
        setError('Device token invalid or revoked. Please re-enroll.')
      } else {
        setError((err as { message?: string }).message ?? 'Failed to load workers')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Read token from localStorage on mount (keeps SSR/CSR renders in sync)
  useEffect(() => {
    const t = getDeviceToken()
    setToken(t)
    if (t) void loadRoster()
  }, [loadRoster])

  // 4s auto-return after confirmation
  useEffect(() => {
    if (!confirmation) return
    const t = setTimeout(() => {
      setConfirmation(null)
      void loadRoster()
    }, 4000)
    return () => clearTimeout(t)
  }, [confirmation, loadRoster])

  useIdleTimer(
    45_000,
    () => {
      setSelected(null)
      setConfirmation(null)
    },
    token !== null,
  )

  function handleEnroll() {
    const value = enrollInput.trim()
    if (!value) return
    setDeviceToken(value)
    setToken(value)
    setError(null)
    void loadRoster()
  }

  const stateBadgeStyle = (state: RosterItem['state']): React.CSSProperties => {
    if (state === 'clocked_in') return { color: 'var(--success)', fontWeight: 600 }
    if (state === 'on_break') return { color: 'var(--warning)', fontWeight: 600 }
    return { color: 'var(--muted-foreground)' }
  }

  // Enrollment screen
  if (!token) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          takt Kiosk<span style={{ color: 'var(--primary)' }}>.</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Enter the device token provided by your manager to activate this kiosk.
        </p>
        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Input
            type="text"
            placeholder="Device token"
            value={enrollInput}
            onChange={(e) => setEnrollInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEnroll() }}
          />
          <Button size="lg" onClick={handleEnroll} disabled={!enrollInput.trim()}>
            Activate kiosk
          </Button>
        </div>
      </main>
    )
  }

  // Confirmation screen
  if (confirmation) {
    return (
      <main
        className="flex min-h-dvh w-full flex-col items-center justify-center gap-4"
        style={{ background: 'var(--background)' }}
      >
        <p
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}
        >
          {confirmation}
        </p>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Returning to clock-in screen...
        </p>
      </main>
    )
  }

  // Worker grid
  return (
    <main className="flex min-h-dvh w-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          takt Kiosk<span style={{ color: 'var(--primary)' }}>.</span>
        </h1>
        {loading && (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Loading...
          </p>
        )}
        {error && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </header>

      {roster && roster.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No PIN-enabled workers found. Ask your manager to set PINs for each worker.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {roster?.map((worker) => (
          <button
            key={worker.employeeId}
            onClick={() => setSelected(worker)}
            className="flex flex-col gap-2 rounded-2xl border p-5 text-left transition-colors hover:bg-accent"
            style={{ borderColor: 'var(--border)', minHeight: '120px', cursor: 'pointer' }}
          >
            <span
              className="text-lg font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {worker.name}
            </span>
            <span className="text-sm capitalize" style={stateBadgeStyle(worker.state)}>
              {worker.state.replace('_', ' ')}
            </span>
          </button>
        ))}
      </div>

      <PinPad
        worker={selected}
        onClose={() => setSelected(null)}
        onPunched={(label) => {
          setSelected(null)
          setConfirmation(label)
        }}
      />
    </main>
  )
}
