import { PunchSubmitInput, PunchSubmitOutput } from '@takt/domain'
import { authed, pub } from './orpc'
import { submitPunch } from './services/punch'

const health = pub.handler(() => ({ ok: true as const, service: 'takt-api' as const }))

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

export const router = {
  health,
  time: {
    punch: {
      submit: punchSubmit,
    },
  },
}

export type Router = typeof router
