import { createAccessControl } from 'better-auth/plugins/access'

/**
 * Permission verbs gated on oRPC procedures. The four takt org roles map onto these.
 * Keep this the single source of truth for "who can do what".
 */
export const statement = {
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  device: ['register'],
  employee: ['read', 'manage', 'set_pin'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
  organization: ['manage'],
} as const

export const ac = createAccessControl(statement)

export const employee = ac.newRole({
  timesheet: ['view'],
  punch: ['create'],
  form: ['submit'],
})

export const manager = ac.newRole({
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  device: ['register'],
  employee: ['read', 'set_pin'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
})

export const peopleManager = ac.newRole({
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  device: ['register'],
  employee: ['read', 'manage', 'set_pin'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
})

export const owner = ac.newRole({
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  device: ['register'],
  employee: ['read', 'manage', 'set_pin'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
  organization: ['manage'],
})

export const roles = { owner, manager, people_manager: peopleManager, employee }

// Granted-permissions map per role, read by the oRPC requirePermission middleware.
// `.statements` is the object passed to ac.newRole — the role's granted verbs.
const grantsByRole: Record<string, Record<string, readonly string[] | undefined>> = {
  owner: owner.statements,
  manager: manager.statements,
  people_manager: peopleManager.statements,
  employee: employee.statements,
}

/** True if `role` is granted `action` on `resource` per the statements above. */
export function roleCan(role: string, resource: string, action: string): boolean {
  return grantsByRole[role]?.[resource]?.includes(action) ?? false
}
