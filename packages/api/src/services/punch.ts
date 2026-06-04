import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, employeeProfile, timeEntry, withOrgCtx } from '@takt/db'
import type { PunchSubmitInput, PunchSubmitOutput } from '@takt/domain'
import { and, eq } from 'drizzle-orm'

/** Idempotent, append-only punch write through the RLS bridge. Source-agnostic. */
export async function submitPunch(
  db: Database,
  ctx: OrgCtx,
  input: PunchSubmitInput,
): Promise<PunchSubmitOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [profile] = await tx
      .select({ id: employeeProfile.id })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
      .limit(1)
    if (!profile) {
      throw new ORPCError('NOT_FOUND', {
        message: 'No employee profile for this user in the active organization',
      })
    }

    const inserted = await tx
      .insert(timeEntry)
      .values({
        clientUuid: input.clientUuid,
        orgId: ctx.orgId,
        employeeId: profile.id,
        assignmentId: input.assignmentId,
        type: input.type,
        source: input.source,
        capturedAtClient: new Date(input.capturedAtClient),
        lat: input.location?.lat,
        lng: input.location?.lng,
        accuracyM: input.location?.accuracyM,
        mockLocation: input.location?.mock ?? false,
        deviceId: input.deviceId,
        nfcTagId: input.nfcTagId,
        photoRef: input.photoRef,
      })
      .onConflictDoNothing({ target: timeEntry.clientUuid })
      .returning()

    let row = inserted[0]
    if (!row) {
      const [existing] = await tx
        .select()
        .from(timeEntry)
        .where(eq(timeEntry.clientUuid, input.clientUuid))
        .limit(1)
      row = existing
    }
    if (!row) {
      throw new ORPCError('CONFLICT', {
        message: 'client_uuid already used in another organization',
      })
    }

    return {
      entryId: row.id,
      recordedAtServer: row.recordedAtServer.toISOString(),
      inZone: row.inZone ?? null,
      status: row.status,
      irregularities: [],
    }
  })
}
