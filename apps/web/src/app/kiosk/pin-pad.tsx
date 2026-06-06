'use client'
import { useState } from 'react'
import { Backspace } from '@phosphor-icons/react'
import type { PunchState } from '@takt/domain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { kioskClient } from '@/lib/orpc-kiosk'

interface Worker {
  employeeId: string
  name: string
  state: PunchState
}

interface PinPadProps {
  worker: Worker | null
  onClose: () => void
  onPunched: (label: string) => void
}

export function PinPad({ worker, onClose, onPunched }: PinPadProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function handleOpen(next: boolean) {
    if (!next) {
      setPin('')
      setError(null)
      onClose()
    }
  }

  function appendDigit(d: string) {
    if (pin.length < 6) setPin((p) => p + d)
  }

  async function submit(type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end', label: string) {
    if (!worker) return
    setBusy(true)
    setError(null)
    try {
      await kioskClient.time.punch.kiosk({
        employeeId: worker.employeeId,
        pin,
        clientUuid: crypto.randomUUID(),
        type,
        capturedAtClient: new Date().toISOString(),
      })
      onPunched(label)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'UNAUTHORIZED') {
        setError('Incorrect PIN')
        setPin('')
      } else {
        setError((err as { message?: string }).message ?? 'Punch failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const validPin = /^\d{4,6}$/.test(pin)

  return (
    <Dialog open={worker !== null} onOpenChange={handleOpen}>
      <DialogContent
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault() }}
        onInteractOutside={(e) => { if (busy) e.preventDefault() }}
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>
            {worker?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* PIN display */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: Math.max(pin.length || 4, 4) }).map((_, i) => (
              <span
                key={i}
                className="flex h-10 w-8 items-center justify-center rounded border text-xl"
                style={{ fontFamily: 'var(--font-mono)', borderColor: 'var(--border)' }}
              >
                {i < pin.length ? '•' : ''}
              </span>
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <Button
                key={d}
                variant="outline"
                className="h-16 text-2xl"
                onClick={() => appendDigit(d)}
                disabled={busy}
              >
                {d}
              </Button>
            ))}
            <Button variant="outline" className="h-16 text-base" onClick={() => setPin('')} disabled={busy}>
              Clear
            </Button>
            <Button variant="outline" className="h-16 text-2xl" onClick={() => appendDigit('0')} disabled={busy}>
              0
            </Button>
            <Button
              variant="outline"
              className="h-16"
              onClick={() => setPin((p) => p.slice(0, -1))}
              disabled={busy}
              aria-label="Backspace"
            >
              <Backspace size={28} />
            </Button>
          </div>

          {error && (
            <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {worker?.state === 'clocked_out' && (
              <Button
                size="lg"
                disabled={!validPin || busy}
                onClick={() => submit('clock_in', 'Clocked in')}
              >
                Clock in
              </Button>
            )}
            {worker?.state === 'on_break' && (
              <Button
                size="lg"
                disabled={!validPin || busy}
                onClick={() => submit('break_end', 'Break ended')}
              >
                End break
              </Button>
            )}
            {worker?.state === 'clocked_in' && (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!validPin || busy}
                  onClick={() => submit('break_start', 'Break started')}
                >
                  Start break
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={!validPin || busy}
                  onClick={() => submit('clock_out', 'Clocked out')}
                  style={{ color: 'var(--danger)' }}
                >
                  Clock out
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
