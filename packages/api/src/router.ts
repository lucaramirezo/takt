import { ORPCError } from '@orpc/server'
import { PunchSubmitInput, PunchSubmitOutput } from '@takt/domain'
import { pub } from './orpc'

const health = pub.handler(() => ({ ok: true as const, service: 'takt-api' as const }))

// Contract is defined now; the handler lands in Phase 1 (Archon: remote clock-in + geofence).
// Keep every returned field declared in PunchSubmitOutput: oRPC strips undeclared fields.
const punchSubmit = pub
  .input(PunchSubmitInput)
  .output(PunchSubmitOutput)
  .handler(() => {
    throw new ORPCError('NOT_IMPLEMENTED', { message: 'time.punch.submit lands in Phase 1' })
  })

export const router = {
  health,
  time: {
    punch: {
      submit: punchSubmit,
    },
  },
}

export type Router = typeof router
