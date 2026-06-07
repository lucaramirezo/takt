'use client'
import { useEffect, useRef } from 'react'

/** Fire onIdle after `timeoutMs` of no pointer/key activity. Resets on activity. Inert when !enabled. */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled: boolean): void {
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current(), timeoutMs)
    }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    for (const e of events) window.addEventListener(e, reset, { passive: true })
    reset()
    return () => {
      clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, reset)
    }
  }, [timeoutMs, enabled])
}
