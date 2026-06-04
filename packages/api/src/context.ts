import type { Database } from '@takt/db'

/**
 * Per-request oRPC context. Built in apps/api from the Better Auth session.
 * orgId + memberRole drive both the permission checks and the RLS bridge (withOrgCtx).
 * siteId + deviceId are populated by kioskAuthed for the kiosk punch path.
 */
export interface TaktContext {
  db: Database
  reqHeaders: Headers
  userId?: string
  orgId?: string
  memberRole?: string
  siteId?: string
  deviceId?: string
}
