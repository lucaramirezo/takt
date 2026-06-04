import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, type Tx, employeeProfile, timeEntry, withOrgCtx } from '@takt/db'
import type { KioskPunchInput, PunchSubmitInput, PunchSubmitOutput } from '@takt/domain'
import { and, eq } from 'drizzle-orm'
import { verifyPin } from '../lib/crypto'

interface InsertTimeEntryParams {
  orgId: string
  employeeId: string
  clientUuid: string
  type: PunchSubmitInput['type']
  source: PunchSubmitInput['source']
  capturedAtClient: string
  assignmentId?: string
  location?: PunchSubmitInput['location']
  deviceId?: string
  nfcTagId?: string
  photoRef?: string
}

/** Idempotent, append-only time_entry insert. Caller supplies the resolved employeeId + source. Runs inside withOrgCtx. */
export async function insertTimeEntry(tx: Tx, p: InsertTimeEntryParams): Promise<PunchSubmitOutput> {
  const inserted = await tx
    .insert(timeEntry)
    .values({
      clientUuid: p.clientUuid,
      orgId: p.orgId,
      employeeId: p.employeeId,
      assignmentId: p.assignmentId,
      type: p.type,
      source: p.source,
      capturedAtClient: new Date(p.capturedAtClient),
      lat: p.location?.lat,
      lng: p.location?.lng,
      accuracyM: p.location?.accuracyM,
      mockLocation: p.location?.mock ?? false,
      deviceId: p.deviceId,
      nfcTagId: p.nfcTagId,
      photoRef: p.photoRef,
    })
    .onConflictDoNothing({ target: timeEntry.clientUuid })
    .returning()
  let row = inserted[0]
  if (!row) {
    const [existing] = await tx.select().from(timeEntry).where(eq(timeEntry.clientUuid, p.clientUuid)).limit(1)
    row = existing
  }
  if (!row) throw new ORPCError('CONFLICT', { message: 'client_uuid already used in another organization' })
  return {
    entryId: row.id,
    recordedAtServer: row.recordedAtServer.toISOString(),
    inZone: row.inZone ?? null,
    status: row.status,
    irregularities: [],
  }
}

export async function submitPunch(db: Database, ctx: OrgCtx, input: PunchSubmitInput): Promise<PunchSubmitOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [profile] = await tx
      .select({ id: employeeProfile.id })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
      .limit(1)
    if (!profile) throw new ORPCError('NOT_FOUND', { message: 'No employee profile for this user in the active organization' })
    return insertTimeEntry(tx, {
      orgId: ctx.orgId,
      employeeId: profile.id,
      clientUuid: input.clientUuid,
      type: input.type,
      source: input.source,
      capturedAtClient: input.capturedAtClient,
      assignmentId: input.assignmentId,
      location: input.location,
      deviceId: input.deviceId,
      nfcTagId: input.nfcTagId,
      photoRef: input.photoRef,
    })
  })
}

interface KioskCtx { orgId: string; siteId?: string; deviceId: string }

/** Kiosk punch: verify the org-scoped employee's PIN, then write a source=kiosk entry as a synthetic device actor. */
export async function submitKioskPunch(db: Database, kiosk: KioskCtx, input: KioskPunchInput): Promise<PunchSubmitOutput> {
  // Read on the superuser connection (no session). SCOPE BY device.orgId — this is the cross-tenant guard.
  const [employee] = await db
    .select({ id: employeeProfile.id, pinHash: employeeProfile.pinHash })
    .from(employeeProfile)
    .where(and(eq(employeeProfile.id, input.employeeId), eq(employeeProfile.orgId, kiosk.orgId)))
    .limit(1)
  // Uniform UNAUTHORIZED: do not leak whether the employee exists, has no PIN, or belongs to another org.
  if (!employee?.pinHash || !(await verifyPin(input.pin, employee.pinHash))) {
    // TODO: add rate-limiting (brute-force risk on low-entropy PINs)
    throw new ORPCError('UNAUTHORIZED')
  }
  const ctx: OrgCtx = { orgId: kiosk.orgId, userId: `kiosk:${kiosk.deviceId}`, memberRole: 'kiosk' }
  return withOrgCtx(db, ctx, (tx) =>
    insertTimeEntry(tx, {
      orgId: kiosk.orgId,
      employeeId: employee.id,
      clientUuid: input.clientUuid,
      type: input.type,
      source: 'kiosk',
      capturedAtClient: input.capturedAtClient,
      assignmentId: input.assignmentId,
      deviceId: kiosk.deviceId,
    }),
  )
}
