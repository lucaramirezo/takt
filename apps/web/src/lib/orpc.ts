import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'

// RPCLink builds `new URL(url)` -> the base MUST be absolute (a relative path throws). Same-origin so the
// browser includes the session cookie automatically; the Next.js rewrite forwards /api/v1/rpc to :3000.
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const link = new RPCLink({ url: `${baseUrl}/api/v1/rpc` })

export const client: RouterClient<Router> = createORPCClient(link)
