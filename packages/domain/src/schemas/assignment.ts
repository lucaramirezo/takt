import { z } from 'zod'

/** The geofence bound to a worker's active remote-ops assignment. Drives the /remote map + client-side zone hint. */
export const RemoteGeofence = z.object({
  id: z.string().uuid(),
  name: z.string(),
  centerLat: z.number(),
  centerLng: z.number(),
  radiusM: z.number().int().positive(),
})
export type RemoteGeofence = z.infer<typeof RemoteGeofence>

/** The authed worker's current remote assignment, or null when none is provisioned. */
export const RemoteAssignmentOutput = z.object({
  assignment: z
    .object({
      assignmentId: z.string().uuid(),
      geofence: RemoteGeofence,
    })
    .nullable(),
})
export type RemoteAssignmentOutput = z.infer<typeof RemoteAssignmentOutput>
