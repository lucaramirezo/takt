import { sql } from 'drizzle-orm'
import type { Database } from './client'

/**
 * Tenant context bridged into Postgres for Row-Level Security.
 * Every org-scoped mutation MUST run inside withOrgCtx so RLS can enforce isolation
 * even if application code has a bug. See CLAUDE.md (RBAC + RLS).
 */
export interface OrgCtx {
  orgId: string
  userId: string
  memberRole: string
}

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

export async function withOrgCtx<T>(
  db: Database,
  ctx: OrgCtx,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL: scoped to this transaction only. takt_api is a non-superuser (no BYPASS RLS).
    await tx.execute(sql`select set_config('role', 'takt_api', true)`)
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId}, true)`)
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`)
    await tx.execute(sql`select set_config('app.member_role', ${ctx.memberRole}, true)`)
    return fn(tx)
  })
}
