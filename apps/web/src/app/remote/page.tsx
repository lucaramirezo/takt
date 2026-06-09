'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { haversineMeters } from '@/lib/geo'
import { client } from '@/lib/orpc'

const GeofenceMap = dynamic(() => import('@/components/remote/geofence-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
})

type Status = Awaited<ReturnType<typeof client.time.punch.status>>
type Assignment = Awaited<ReturnType<typeof client.time.assignment.active>>['assignment']
type PunchResult = Awaited<ReturnType<typeof client.time.punch.submit>>
type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
type Fix = { lat: number; lng: number; accuracyM: number }

export default function RemotePage() {
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PunchResult | null>(null)
  const loadedRef = useRef(false)

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await client.time.punch.status())
      setError(null)
    } catch (err) {
      const code = (err as { code?: string }).code
      const httpStatus = (err as { status?: number }).status
      if (code === 'UNAUTHORIZED' || httpStatus === 401) {
        router.push('/login')
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to load status')
    }
  }, [router])

  // Initial load: active remote assignment + current punch state.
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void (async () => {
      try {
        const res = await client.time.assignment.active()
        setAssignment(res.assignment)
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code === 'UNAUTHORIZED') {
          router.push('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load assignment')
      }
      await loadStatus()
    })()
  }, [router, loadStatus])

  // Live foreground GPS. watchPosition keeps the dot + zone hint current as the worker moves.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not available on this device')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Math.round(pos.coords.accuracy) })
      },
      (err) => setGeoError(err.message || 'Could not read your location'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const geofence = assignment?.geofence ?? null

  // Client-side zone hint (the server recomputes authoritatively on punch).
  const inZone = useMemo<boolean | null>(() => {
    if (!geofence || !fix) return null
    return haversineMeters(fix.lat, fix.lng, geofence.centerLat, geofence.centerLng) <= geofence.radiusM
  }, [geofence, fix])

  async function punch(type: PunchType) {
    if (!fix) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await client.time.punch.submit({
        clientUuid: crypto.randomUUID(),
        type,
        source: 'remote',
        capturedAtClient: new Date().toISOString(),
        assignmentId: assignment?.assignmentId,
        location: { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, mock: false },
      })
      setResult(res)
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Punch failed')
    } finally {
      setBusy(false)
    }
  }

  const canPunch = !!fix && !busy

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
          Remote<span style={{ color: 'var(--primary)' }}>.</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {geofence ? (
            <>
              Site: <span style={{ color: 'var(--foreground)' }}>{geofence.name}</span>
            </>
          ) : (
            'Field clock-in'
          )}
        </p>
      </header>

      {geofence ? (
        <>
          <div className="relative h-72 w-full overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <GeofenceMap
              center={{ lat: geofence.centerLat, lng: geofence.centerLng }}
              radiusM={geofence.radiusM}
              worker={fix ? { lat: fix.lat, lng: fix.lng } : null}
              inZone={inZone}
            />
            <ZoneBadge inZone={inZone} locating={!fix && !geoError} errored={!!geoError && !fix} />
          </div>

          <div className="flex items-center justify-between text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--muted-foreground)' }}>
              {fix ? `${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)}` : 'Locating...'}
            </span>
            {fix && <span style={{ color: 'var(--muted-foreground)' }}>±{fix.accuracyM} m</span>}
          </div>
        </>
      ) : (
        <p className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          No remote assignment is provisioned for your account.
        </p>
      )}

      {geoError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{geoError}</p>}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      {status && geofence && (
        <div className="flex flex-col gap-3">
          {status.state === 'clocked_out' && (
            <Button onClick={() => punch('clock_in')} disabled={!canPunch} size="lg" className="min-h-14">
              Clock in
            </Button>
          )}
          {status.state === 'clocked_in' && (
            <>
              <Button onClick={() => punch('break_start')} disabled={!canPunch} variant="secondary" size="lg" className="min-h-14">
                Start break
              </Button>
              <Button
                onClick={() => punch('clock_out')}
                disabled={!canPunch}
                variant="outline"
                size="lg"
                className="min-h-14"
                style={{ color: 'var(--danger)' }}
              >
                Clock out
              </Button>
            </>
          )}
          {status.state === 'on_break' && (
            <Button onClick={() => punch('break_end')} disabled={!canPunch} size="lg" className="min-h-14">
              End break
            </Button>
          )}
        </div>
      )}

      {result && <PunchVerdict result={result} />}
    </main>
  )
}

function ZoneBadge({ inZone, locating, errored }: { inZone: boolean | null; locating: boolean; errored: boolean }) {
  const label = errored ? 'Location unavailable' : locating || inZone == null ? 'Locating...' : inZone ? 'On site' : 'Outside zone'
  const color = errored || inZone == null ? 'var(--muted-foreground)' : inZone ? 'var(--success)' : 'var(--primary)'
  return (
    <div
      className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
      style={{ background: 'color-mix(in oklch, var(--card) 88%, transparent)', color }}
    >
      <span className={`takt-live-dot${inZone === false ? ' is-alert' : ''}`} />
      {label}
    </div>
  )
}

function PunchVerdict({ result }: { result: PunchResult }) {
  const flagged = result.status === 'flagged'
  const color = flagged ? 'var(--primary)' : 'var(--success)'
  return (
    <div
      className="rounded-xl border p-4 text-sm"
      style={{ borderColor: color, background: `color-mix(in oklch, ${color} 8%, transparent)` }}
    >
      <p className="font-medium" style={{ color }}>
        {flagged ? 'Flagged: outside zone' : 'Recorded on site'}
      </p>
      <p className="mt-1" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
        {new Date(result.recordedAtServer).toLocaleTimeString()}
        {result.inZone != null && ` · ${result.inZone ? 'in zone' : 'out of zone'}`}
        {result.irregularities.length > 0 && ` · ${result.irregularities.join(', ')}`}
      </p>
    </div>
  )
}
