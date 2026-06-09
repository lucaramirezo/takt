import { z } from 'zod'

export const IrregularityListInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type IrregularityListInput = z.infer<typeof IrregularityListInput>

export const irregularityTypeSchema = z.enum(['out_of_zone', 'missing_clock_out', 'overtime'])
export type IrregularityType = z.infer<typeof irregularityTypeSchema>

export const irregularitySeveritySchema = z.enum(['high', 'medium', 'low'])
export type IrregularitySeverity = z.infer<typeof irregularitySeveritySchema>

/** One detected exception over the append-only punch stream. `id` is a synthetic stable key (not a DB row). */
export const IrregularityRow = z.object({
  id: z.string(),
  type: irregularityTypeSchema,
  severity: irregularitySeveritySchema,
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  day: z.string(), // YYYY-MM-DD (UTC bucket; org IANA zone is future work)
  at: z.string().datetime().nullable(),
  detail: z.string(),
})
export type IrregularityRow = z.infer<typeof IrregularityRow>

export const IrregularityListOutput = z.object({
  irregularities: z.array(IrregularityRow),
  range: z.object({ from: z.string().datetime(), to: z.string().datetime() }),
  counts: z.object({
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
    total: z.number().int(),
  }),
})
export type IrregularityListOutput = z.infer<typeof IrregularityListOutput>
