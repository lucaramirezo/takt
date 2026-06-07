'use client'
import { useEffect, useRef } from 'react'

/** Hold a screen wake lock while mounted; re-acquire when the tab returns to foreground. Best-effort. */
export function useWakeLock(): void {
  const sentinel = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    let unmounted = false
    async function acquire() {
      try {
        if ('wakeLock' in navigator) {
          const s = await navigator.wakeLock.request('screen')
          if (unmounted) { void s.release().catch(() => {}); return }
          sentinel.current = s
        }
      } catch {
        // wake lock denied (battery saver, unsupported) -> degrade silently
      }
    }
    void acquire()
    function onVisibility() {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unmounted = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel.current?.release().catch(() => {})
      sentinel.current = null
    }
  }, [])
}
