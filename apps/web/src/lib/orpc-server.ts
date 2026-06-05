import 'server-only'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { Router } from '@takt/api'
import { headers } from 'next/headers'

const link = new RPCLink({
  url: `${process.env.API_BASE_URL ?? 'http://localhost:3000'}/api/v1/rpc`,
  headers: async () => {
    const cookie = (await headers()).get('cookie')
    return cookie ? { cookie } : {}
  },
})

export const serverClient: RouterClient<Router> = createORPCClient(link)
