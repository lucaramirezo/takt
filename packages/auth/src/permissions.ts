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
  employee: ['read', 'manage'],
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
  employee: ['read'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
})

export const peopleManager = ac.newRole({
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  employee: ['read', 'manage'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
})

export const owner = ac.newRole({
  timesheet: ['view', 'approve', 'edit'],
  punch: ['create', 'edit'],
  geofence: ['read', 'write'],
  assignment: ['read', 'write'],
  employee: ['read', 'manage'],
  irregularity: ['read', 'resolve'],
  form: ['read', 'build', 'submit'],
  export: ['run'],
  organization: ['manage'],
})

export const roles = { owner, manager, people_manager: peopleManager, employee }
