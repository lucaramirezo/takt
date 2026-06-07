import { z } from 'zod'
import { clockSourceSchema, punchTypeSchema } from './punch'

export const TimesheetGetInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  employeeId: z.string().uuid().optional(),
})
export type TimesheetGetInput = z.infer<typeof TimesheetGetInput>

export const TimesheetEntryRow = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeName: z.string(),
  type: punchTypeSchema,
  source: clockSourceSchema,
  capturedAtClient: z.string().datetime(),
  recordedAtServer: z.string().datetime(),
  status: z.enum(['valid', 'flagged']),
  inZone: z.boolean().nullable(),
})
export type TimesheetEntryRow = z.infer<typeof TimesheetEntryRow>

export const TimesheetEmployee = z.object({
  employeeId: z.string().uuid(),
  name: z.string(),
})
export type TimesheetEmployee = z.infer<typeof TimesheetEmployee>

export const TimesheetGetOutput = z.object({
  entries: z.array(TimesheetEntryRow),
  employees: z.array(TimesheetEmployee),
  range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
})
export type TimesheetGetOutput = z.infer<typeof TimesheetGetOutput>
