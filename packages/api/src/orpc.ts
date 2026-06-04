import { ORPCError, os } from '@orpc/server'
import { auth, roleCan } from '@takt/auth'
import { kioskDevice, orgMembers } from '@takt/db'
import { and, eq } from 'drizzle-orm'
import type { TaktContext } from './context'
import { hashDeviceToken } from './lib/crypto'

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

/** Device-token gate for kiosk punches. Resolves org+site+device from the x-takt-device-token header. */
export const kioskAuthed = pub.use(async ({ context, next }) => {
  const token = context.reqHeaders.get('x-takt-device-token')
  if (!token) throw new ORPCError('UNAUTHORIZED')
  const tokenHash = hashDeviceToken(token)
  const [device] = await context.db
    .select({ id: kioskDevice.id, orgId: kioskDevice.orgId, siteId: kioskDevice.siteId })
    .from(kioskDevice)
    .where(and(eq(kioskDevice.tokenHash, tokenHash), eq(kioskDevice.active, true)))
    .limit(1)
  if (!device) throw new ORPCError('UNAUTHORIZED')
  return next({ context: { ...context, orgId: device.orgId, siteId: device.siteId ?? undefined, deviceId: device.id } })
})

/** Builds on `authed`; rejects unless the member role is granted `resource:action`. */
export function requirePermission(resource: string, action: string) {
  return authed.use(({ context, next }) => {
    if (!context.memberRole || !roleCan(context.memberRole, resource, action)) {
      throw new ORPCError('FORBIDDEN', { message: 'Insufficient permissions' })
    }
    return next({ context })
  })
}
