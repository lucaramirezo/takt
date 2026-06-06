'use client'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'

const TOKEN_KEY = 'takt.deviceToken'
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setDeviceToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearDeviceToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// Re-read the token on every call (re-enrollment without reload). Same-origin so the Next rewrite
// forwards the header to :3000; omit credentials so a stale admin cookie never travels with kiosk calls.
const link = new RPCLink({
  url: `${baseUrl}/api/v1/rpc`,
  headers: () => {
    const token = getDeviceToken()
    return token ? { 'x-takt-device-token': token } : {}
  },
  fetch: (input, init) => fetch(input, { ...init, credentials: 'omit' }),
})

export const kioskClient: RouterClient<Router> = createORPCClient(link)
