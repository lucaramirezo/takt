import { createAuthClient } from 'better-auth/client'
import { organizationClient } from 'better-auth/client/plugins'

// Same-origin: the browser talks to :3001; next.config rewrites /api/auth/* to the Fastify API on :3000.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
  plugins: [organizationClient()],
})
