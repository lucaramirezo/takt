import { ORPCError, os } from '@orpc/server'
import { auth } from '@takt/auth'
import { orgMembers } from '@takt/db'
import { and, eq } from 'drizzle-orm'
import type { TaktContext } from './context'

/** Base oRPC builder bound to the takt context. Procedures + middleware build off this. */
export const pub = os.$context<TaktContext>()

/** Auth gate: resolves the Better Auth session + active-org membership into context. */
export const authed = pub.use(async ({ context, next }) => {
  const result = await auth.api.getSession({ headers: context.reqHeaders })
  if (!result?.session || !result.user) throw new ORPCError('UNAUTHORIZED')
  const orgId = result.session.activeOrganizationId
  if (!orgId) throw new ORPCError('FORBIDDEN', { message: 'No active organization' })
  const [membership] = await context.db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, result.user.id)))
    .limit(1)
  if (!membership) throw new ORPCError('FORBIDDEN', { message: 'Not a member of the active organization' })
  return next({ context: { ...context, userId: result.user.id, orgId, memberRole: membership.role } })
})
