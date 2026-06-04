import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, employeeProfile, withOrgCtx } from '@takt/db'
import type { SetPinInput, SetPinOutput } from '@takt/domain'
import { eq } from 'drizzle-orm'
import { hashPin } from '../lib/crypto'

/** Manager sets/resets an employee's kiosk PIN. RLS scopes the UPDATE to ctx.orgId. */
export async function setEmployeePin(db: Database, ctx: OrgCtx, input: SetPinInput): Promise<SetPinOutput> {
  const pinHash = await hashPin(input.pin)
  return withOrgCtx(db, ctx, async (tx) => {
    const updated = await tx
      .update(employeeProfile)
      .set({ pinHash, updatedAt: new Date() })
      .where(eq(employeeProfile.id, input.employeeId))
      .returning({ id: employeeProfile.id })
    if (!updated[0]) throw new ORPCError('NOT_FOUND', { message: 'Employee not found in this organization' })
    return { employeeId: updated[0].id, pinSet: true }
  })
}
