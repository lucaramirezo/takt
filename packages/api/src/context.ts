import type { Database } from '@takt/db'

/**
 * Per-request oRPC context. Built in services/api from the Better Auth session.
 * orgId + memberRole drive both the permission checks and the RLS bridge (withOrgCtx).
 */
export interface TaktContext {
  db: Database
  reqHeaders: Headers
  userId?: string
  orgId?: string
  memberRole?: string
}
