import { type Database, type OrgCtx, assignment, employeeProfile, geofence, withOrgCtx } from '@takt/db'
import type { RemoteAssignmentOutput } from '@takt/domain'
import { and, desc, eq, isNotNull } from 'drizzle-orm'

/**
 * The authed worker's most recent remote-ops assignment that carries a geofence.
 * Self-scoped: resolves the employee profile from ctx.userId, so any member may read their own.
 * Runs inside withOrgCtx; RLS scopes assignment + geofence to the active org.
 */
export async function getActiveAssignment(db: Database, ctx: OrgCtx): Promise<RemoteAssignmentOutput> {
  return withOrgCtx(db, ctx, async (tx) => {
    const [profile] = await tx
      .select({ id: employeeProfile.id })
      .from(employeeProfile)
      .where(and(eq(employeeProfile.userId, ctx.userId), eq(employeeProfile.orgId, ctx.orgId)))
      .limit(1)
    if (!profile) return { assignment: null }

    const [row] = await tx
      .select({
        assignmentId: assignment.id,
        geofenceId: geofence.id,
        name: geofence.name,
        centerLat: geofence.centerLat,
        centerLng: geofence.centerLng,
        radiusM: geofence.radiusM,
      })
      .from(assignment)
      .innerJoin(geofence, eq(geofence.id, assignment.geofenceId))
      .where(
        and(
          eq(assignment.employeeId, profile.id),
          eq(assignment.remoteOpsEnabled, true),
          isNotNull(assignment.geofenceId),
        ),
      )
      // Deterministic total order, matching evaluateRemoteZone, so the map and the punch verdict agree.
      .orderBy(desc(assignment.createdAt), desc(assignment.id))
      .limit(1)
    if (!row) return { assignment: null }

    return {
      assignment: {
        assignmentId: row.assignmentId,
        geofence: {
          id: row.geofenceId,
          name: row.name,
          centerLat: row.centerLat,
          centerLng: row.centerLng,
          radiusM: row.radiusM,
        },
      },
    }
  })
}
