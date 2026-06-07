import { z } from 'zod'
import { PunchSubmitOutput, punchStateSchema, punchTypeSchema } from './punch'

const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits')

// employee.pin.set (manager-set)
export const SetPinInput = z.object({ employeeId: z.string().uuid(), pin: pinSchema })
export type SetPinInput = z.infer<typeof SetPinInput>
export const SetPinOutput = z.object({ employeeId: z.string().uuid(), pinSet: z.literal(true) })
export type SetPinOutput = z.infer<typeof SetPinOutput>

// device.register (returns plaintext token once)
export const RegisterDeviceInput = z.object({ name: z.string().min(1), siteId: z.string().uuid().optional() })
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceInput>
export const RegisterDeviceOutput = z.object({ deviceId: z.string().uuid(), token: z.string() })
export type RegisterDeviceOutput = z.infer<typeof RegisterDeviceOutput>

// time.punch.kiosk (device-token authed; reuses PunchSubmitOutput)
export const KioskPunchInput = z.object({
  employeeId: z.string().uuid(),
  pin: pinSchema,
  clientUuid: z.string().uuid(),
  type: punchTypeSchema,
  capturedAtClient: z.string().datetime(),
  assignmentId: z.string().uuid().optional(),
})
export type KioskPunchInput = z.infer<typeof KioskPunchInput>
export { PunchSubmitOutput }

// time.punch.kioskRoster (device-token authed READ; session-less worker grid)
export const KioskRosterOutput = z.array(
  z.object({
    employeeId: z.string().uuid(),
    name: z.string(),
    state: punchStateSchema,
  }),
)
export type KioskRosterOutput = z.infer<typeof KioskRosterOutput>
