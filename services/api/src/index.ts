import { RPCHandler } from '@orpc/server/node'
import { router, type TaktContext } from '@takt/api'
import { auth } from '@takt/auth'
import { db } from '@takt/db'
import { toNodeHandler } from 'better-auth/node'
import Fastify from 'fastify'
import { env } from './lib/env'

const app = Fastify({ logger: true })
const rpc = new RPCHandler(router)

app.get('/health', async () => ({ ok: true, service: 'takt-api' }))

// Better Auth reads the raw request stream, so opt its routes out of Fastify's JSON parsing.
app.addContentTypeParser('application/json', (_req, _payload, done) => done(null, null))

app.all('/api/auth/*', async (request, reply) => {
  await toNodeHandler(auth)(request.raw, reply.raw)
  reply.hijack()
})

// oRPC handler. Identity (userId, orgId, memberRole) is resolved by the `authed` oRPC
// middleware inside @takt/api — this route only supplies { db, reqHeaders }.
app.all('/api/v1/rpc/*', async (request, reply) => {
  const context: TaktContext = {
    db,
    reqHeaders: new Headers(request.headers as Record<string, string>),
  }
  const { matched } = await rpc.handle(request.raw, reply.raw, {
    prefix: '/api/v1/rpc',
    context,
  })
  if (matched) {
    reply.hijack()
  } else {
    reply.code(404).send({ error: 'not_found' })
  }
})

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`takt-api listening on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
