import { z } from 'zod'

export const clockSourceSchema = z.enum(['in_app', 'kiosk', 'nfc', 'remote'])
export const punchTypeSchema = z.enum(['clock_in', 'clock_out', 'break_start', 'break_end'])

/** The load-bearing write. Idempotent (clientUuid), server-validated. See CLAUDE.md. */
export const PunchSubmitInput = z.object({
  clientUuid: z.string().uuid(),
  type: punchTypeSchema,
  source: clockSourceSchema,
  assignmentId: z.string().uuid().optional(),
  capturedAtClient: z.string().datetime(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracyM: z.number().int().nonnegative(),
      mock: z.boolean().default(false),
    })
    .optional(),
  deviceId: z.string().optional(),
  nfcTagId: z.string().optional(),
  photoRef: z.string().optional(),
  formSubmissionId: z.string().uuid().optional(),
})
export type PunchSubmitInput = z.infer<typeof PunchSubmitInput>

export const PunchSubmitOutput = z.object({
  entryId: z.string().uuid(),
  recordedAtServer: z.string().datetime(),
  inZone: z.boolean().nullable(),
  status: z.enum(['valid', 'flagged']),
  irregularities: z.array(z.string()).default([]),
})
export type PunchSubmitOutput = z.infer<typeof PunchSubmitOutput>
