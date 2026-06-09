import { ORPCError } from '@orpc/server'
import { type Database, type OrgCtx, type Tx, assignment, employeeProfile, geofence, timeEntry, user, withOrgCtx } from '@takt/db'
import type { KioskPunchInput, KioskRosterOutput, PunchStatusOutput, PunchSubmitInput, PunchSubmitOutput } from '@takt/domain'
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { verifyPin } from '../lib/crypto'
import { haversineMeters } from '../lib/geo'

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
  /** Geofence evaluation (remote punches only). When inZone is false the entry is flagged out_of_zone. */
  inZone?: boolean
  geofenceIdEval?: string
  status?: 'valid' | 'flagged'
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
      inZone: p.inZone,
      geofenceIdEval: p.geofenceIdEval,
      status: p.status,
    })
    .onConflictDoNothing({ target: timeEntry.clientUuid })
    .returning()
  let row = inserted[0]
  if (!row) {
    const [existing] = await tx.select().from(timeEntry).where(eq(timeEntry.clientUuid, p.clientUuid)).limit(1)
    row = existing
  }
  if (!row) throw new ORPCError('CONFLICT', { message: 'client_uuid already used in another organization' })
  // Derive irregularities from the persisted row so idempotent replays return the same verdict.
  const irregularities = row.inZone === false ? ['out_of_zone'] : []
  return {
    entryId: row.id,
    recordedAtServer: row.recordedAtServer.toISOString(),
    inZone: row.inZone ?? null,
    status: row.status,
    irregularities,
  }
}

/**
 * Evaluate a remote punch against the worker's active geofence.
 * Returns the zone verdict, or undefined when no location / no geofenced remote assignment applies.
 * Must run inside the same withOrgCtx tx so the assignment + geofence reads are RLS-scoped.
 */
async function evaluateRemoteZone(
  tx: Tx,
  employeeId: string,
  source: PunchSubmitInput['source'],
  location: PunchSubmitInput['location'],
  requestedAssignmentId: string | undefined,
): Promise<{ inZone: boolean; geofenceIdEval: string; assignmentId: string } | undefined> {
  if (source !== 'remote' || !location) return undefined
  // When the client names an assignment, pin to it AND scope by employeeId so a foreign/other-worker
  // id resolves no row (ownership validation). Otherwise fall back to the worker's latest geofenced one.
  const filters = [
    eq(assignment.employeeId, employeeId),
    eq(assignment.remoteOpsEnabled, true),
    isNotNull(assignment.geofenceId),
    ...(requestedAssignmentId ? [eq(assignment.id, requestedAssignmentId)] : []),
  ]
  const [zone] = await tx
    .select({
      assignmentId: assignment.id,
      geofenceId: geofence.id,
      centerLat: geofence.centerLat,
      centerLng: geofence.centerLng,
      radiusM: geofence.radiusM,
    })
    .from(assignment)
    .innerJoin(geofence, eq(geofence.id, assignment.geofenceId))
    .where(and(...filters))
    // Deterministic total order: the map (getActiveAssignment) and this verdict must resolve the SAME row.
    .orderBy(desc(assignment.createdAt), desc(assignment.id))
    .limit(1)
  if (!zone) return undefined
  const distanceM = haversineMeters(location.lat, location.lng, zone.centerLat, zone.centerLng)
  return { inZone: distanceM <= zone.radiusM, geofenceIdEval: zone.geofenceId, assignmentId: zone.assignmentId }
}

export async function submitPunch(db: Database, ctx: OrgCtx, input: PunchSubmitInput): Promise<PunchSubmitOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [profile] = await tx
      .select({ id: employeeProfile.id })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
      .limit(1)
    if (!profile) throw new ORPCError('NOT_FOUND', { message: 'No employee profile for this user in the active organization' })
    const zone = await evaluateRemoteZone(tx, profile.id, input.source, input.location, input.assignmentId)
    return insertTimeEntry(tx, {
      orgId: ctx.orgId,
      employeeId: profile.id,
      clientUuid: input.clientUuid,
      type: input.type,
      source: input.source,
      capturedAtClient: input.capturedAtClient,
      // Store the server-resolved assignment so assignmentId always matches geofenceIdEval; for
      // non-remote / unevaluated punches keep the client value (unchanged behavior).
      assignmentId: zone?.assignmentId ?? input.assignmentId,
      location: input.location,
      deviceId: input.deviceId,
      nfcTagId: input.nfcTagId,
      photoRef: input.photoRef,
      inZone: zone?.inZone,
      geofenceIdEval: zone?.geofenceIdEval,
      status: zone && !zone.inZone ? 'flagged' : undefined,
    })
  })
}

export async function getPunchStatus(db: Database, ctx: OrgCtx): Promise<PunchStatusOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [profile] = await tx
      .select({ id: employeeProfile.id })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
      .limit(1)
    if (!profile) throw new ORPCError('NOT_FOUND', { message: 'No employee profile for this user in the active organization' })
    const [last] = await tx
      .select({ type: timeEntry.type, recordedAtServer: timeEntry.recordedAtServer })
      .from(timeEntry)
      .where(and(eq(timeEntry.orgId, ctx.orgId), eq(timeEntry.employeeId, profile.id)))
      .orderBy(desc(timeEntry.recordedAtServer))
      .limit(1)
    if (!last) return { state: 'clocked_out', since: null, lastEntryType: null }
    const state =
      last.type === 'break_start' ? 'on_break' : last.type === 'clock_out' ? 'clocked_out' : 'clocked_in'
    return { state, since: last.recordedAtServer.toISOString(), lastEntryType: last.type }
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

export async function listKioskRoster(db: Database, kiosk: { orgId: string }): Promise<KioskRosterOutput> {
  // Only active, PIN-enabled workers in THIS org. eq(orgId) is the cross-tenant guard (raw conn, no RLS).
  const workers = await db
    .select({ employeeId: employeeProfile.id, name: user.name })
    .from(employeeProfile)
    .innerJoin(user, eq(user.id, employeeProfile.userId))
    .where(
      and(
        eq(employeeProfile.orgId, kiosk.orgId),
        eq(employeeProfile.active, true),
        isNotNull(employeeProfile.pinHash),
      ),
    )
    .orderBy(asc(user.name))
  // Per-worker latest state. N+1 over a small roster, run in parallel; refetched on every return-to-grid.
  return Promise.all(
    workers.map(async (w) => {
      const [last] = await db
        .select({ type: timeEntry.type })
        .from(timeEntry)
        .where(and(eq(timeEntry.orgId, kiosk.orgId), eq(timeEntry.employeeId, w.employeeId)))
        .orderBy(desc(timeEntry.recordedAtServer))
        .limit(1)
      const state = !last
        ? 'clocked_out'
        : last.type === 'break_start'
          ? 'on_break'
          : last.type === 'clock_out'
            ? 'clocked_out'
            : 'clocked_in'
      return { employeeId: w.employeeId, name: w.name, state }
    }),
  )
}
