import { z } from 'zod'

export const memberRoleSchema = z.enum(['owner', 'manager', 'people_manager', 'employee'])
export type MemberRole = z.infer<typeof memberRoleSchema>

export const employmentTypeSchema = z.enum(['hourly', 'salaried', 'contractor'])

/** Server-trusted identity for the active org. Values come straight from context (no DB call). */
export const MeOutput = z.object({
  userId: z.string(),
  orgId: z.string(),
  role: memberRoleSchema,
})
export type MeOutput = z.infer<typeof MeOutput>

/** One roster row. employee_profile fields are nullable (LEFT join: members may have no profile). */
export const RosterRow = z.object({
  memberId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: memberRoleSchema,
  employeeProfileId: z.string().uuid().nullable(),
  employmentType: employmentTypeSchema.nullable(),
  active: z.boolean().nullable(),
  joinedAt: z.string().datetime(),
})
export type RosterRow = z.infer<typeof RosterRow>

export const RosterOutput = z.array(RosterRow)
export type RosterOutput = z.infer<typeof RosterOutput>

const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits')

// employee.create
export const EmployeeCreateInput = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: memberRoleSchema,
  employmentType: employmentTypeSchema,
  pin: pinSchema.optional(),
})
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateInput>
export const EmployeeCreateOutput = z.object({
  userId: z.string(),
  memberId: z.string(),
  employeeProfileId: z.string().uuid(),
  role: memberRoleSchema,
})
export type EmployeeCreateOutput = z.infer<typeof EmployeeCreateOutput>

// org.member.setRole
export const SetMemberRoleInput = z.object({ memberId: z.string(), role: memberRoleSchema })
export type SetMemberRoleInput = z.infer<typeof SetMemberRoleInput>
export const SetMemberRoleOutput = z.object({ memberId: z.string(), role: memberRoleSchema })
export type SetMemberRoleOutput = z.infer<typeof SetMemberRoleOutput>
