import {
  KioskPunchInput,
  MeOutput,
  PunchStatusOutput,
  PunchSubmitInput,
  PunchSubmitOutput,
  RegisterDeviceInput,
  RegisterDeviceOutput,
  RosterOutput,
  SetPinInput,
  SetPinOutput,
} from '@takt/domain'
import type { MemberRole } from '@takt/domain'
import { authed, kioskAuthed, pub, requirePermission } from './orpc'
import { registerDevice } from './services/device'
import { setEmployeePin } from './services/employee'
import { getRoster } from './services/org'
import { getPunchStatus, submitKioskPunch, submitPunch } from './services/punch'

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

export const router = {
  health,
  me,
  org: { roster: orgRoster },
  time: { punch: { submit: punchSubmit, kiosk: punchKiosk, status: punchStatus } },
  device: { register: deviceRegister },
  employee: { pin: { set: employeePinSet } },
}

export type Router = typeof router
