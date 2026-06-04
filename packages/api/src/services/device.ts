import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, kioskDevice, site, withOrgCtx } from '@takt/db'
import type { RegisterDeviceInput, RegisterDeviceOutput } from '@takt/domain'
import { and, eq } from 'drizzle-orm'
import { generateDeviceToken, hashDeviceToken } from '../lib/crypto'

/** Register a shared kiosk tablet: store only the token hash, return the plaintext token exactly once. */
export async function registerDevice(db: Database, ctx: OrgCtx, input: RegisterDeviceInput): Promise<RegisterDeviceOutput> {
  const token = generateDeviceToken()
  return withOrgCtx(db, ctx, async (tx) => {
    // siteId is optional; when provided, RLS scopes the select to ctx.orgId to reject cross-org siteIds.
    if (input.siteId) {
      const [s] = await tx
        .select({ id: site.id })
        .from(site)
        .where(and(eq(site.id, input.siteId), eq(site.orgId, ctx.orgId)))
        .limit(1)
      if (!s) throw new ORPCError('NOT_FOUND', { message: 'Site not found in this organization' })
    }
    const [row] = await tx
      .insert(kioskDevice)
      .values({ orgId: ctx.orgId, siteId: input.siteId ?? null, name: input.name, tokenHash: hashDeviceToken(token) })
      .returning({ id: kioskDevice.id })
    return { deviceId: row!.id, token }
  })
}
