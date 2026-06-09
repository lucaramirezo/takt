import {
  EmployeeCreateInput,
  EmployeeCreateOutput,
  IrregularityListInput,
  IrregularityListOutput,
  KioskPunchInput,
  KioskRosterOutput,
  MeOutput,
  PunchStatusOutput,
  PunchSubmitInput,
  PunchSubmitOutput,
  RegisterDeviceInput,
  RegisterDeviceOutput,
  RemoteAssignmentOutput,
  RosterOutput,
  SetMemberRoleInput,
  SetMemberRoleOutput,
  SetPinInput,
  SetPinOutput,
  TimesheetGetInput,
  TimesheetGetOutput,
} from '@takt/domain'
import type { MemberRole } from '@takt/domain'
import { authed, kioskAuthed, pub, requirePermission } from './orpc'
import { getActiveAssignment } from './services/assignment'
import { registerDevice } from './services/device'
import { getIrregularities } from './services/irregularity'
import { setEmployeePin } from './services/employee'
import { createEmployee } from './services/employee-create'
import { setMemberRole } from './services/member'
import { getRoster } from './services/org'
import { getPunchStatus, listKioskRoster, submitKioskPunch, submitPunch } from './services/punch'
import { getTimesheet } from './services/timesheet'

const health = pub.handler(() => ({ ok: true as const, service: 'takt-api' as const }))

const me = authed
  .output(MeOutput)
  .handler(({ context }) => ({
    userId: context.userId,
    orgId: context.orgId,
    role: context.memberRole as MemberRole,
  }))

const orgRoster = requirePermission('employee', 'read')
  .output(RosterOutput)
  .handler(({ context }) =>
    getRoster(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }),
  )

const punchSubmit = authed
  .input(PunchSubmitInput)
  .output(PunchSubmitOutput)
  .handler(({ input, context }) =>
    submitPunch(
      context.db,
      {
        orgId: context.orgId,
        userId: context.userId,
        memberRole: context.memberRole,
      },
      input,
    ),
  )

const punchStatus = authed
  .output(PunchStatusOutput)
  .handler(({ context }) =>
    getPunchStatus(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }),
  )

const punchKiosk = kioskAuthed
  .input(KioskPunchInput)
  .output(PunchSubmitOutput)
  .handler(({ input, context }) =>
    submitKioskPunch(context.db, { orgId: context.orgId, siteId: context.siteId, deviceId: context.deviceId }, input),
  )

const punchKioskRoster = kioskAuthed
  .output(KioskRosterOutput)
  .handler(({ context }) => listKioskRoster(context.db, { orgId: context.orgId }))

const deviceRegister = requirePermission('device', 'register')
  .input(RegisterDeviceInput)
  .output(RegisterDeviceOutput)
  .handler(({ input, context }) =>
    registerDevice(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

const employeePinSet = requirePermission('employee', 'set_pin')
  .input(SetPinInput)
  .output(SetPinOutput)
  .handler(({ input, context }) =>
    setEmployeePin(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

const employeeCreate = requirePermission('employee', 'manage')
  .input(EmployeeCreateInput)
  .output(EmployeeCreateOutput)
  .handler(({ input, context }) =>
    createEmployee(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

const memberSetRole = requirePermission('employee', 'manage')
  .input(SetMemberRoleInput)
  .output(SetMemberRoleOutput)
  .handler(({ input, context }) =>
    setMemberRole(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

const timesheetGet = requirePermission('timesheet', 'view')
  .input(TimesheetGetInput)
  .output(TimesheetGetOutput)
  .handler(({ input, context }) =>
    getTimesheet(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

// Worker-facing: any member may read THEIR OWN active remote assignment (self-scoped by ctx.userId).
const assignmentActive = authed
  .output(RemoteAssignmentOutput)
  .handler(({ context }) =>
    getActiveAssignment(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }),
  )

// Manager-facing exceptions inbox: detected over the punch stream (owner/manager/people_manager).
const irregularityList = requirePermission('irregularity', 'read')
  .input(IrregularityListInput)
  .output(IrregularityListOutput)
  .handler(({ input, context }) =>
    getIrregularities(context.db, { orgId: context.orgId, userId: context.userId, memberRole: context.memberRole }, input),
  )

export const router = {
  health,
  me,
  org: { roster: orgRoster, member: { setRole: memberSetRole } },
  time: {
    punch: { submit: punchSubmit, kiosk: punchKiosk, status: punchStatus, kioskRoster: punchKioskRoster },
    timesheet: { get: timesheetGet },
    assignment: { active: assignmentActive },
    irregularity: { list: irregularityList },
  },
  device: { register: deviceRegister },
  employee: { pin: { set: employeePinSet }, create: employeeCreate },
}

export type Router = typeof router
