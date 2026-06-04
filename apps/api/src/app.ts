import { RPCHandler } from '@orpc/server/node'
import { router, type TaktContext } from '@takt/api'
import { auth } from '@takt/auth'
import { db } from '@takt/db'
import { toNodeHandler } from 'better-auth/node'
import Fastify, { type FastifyInstance } from 'fastify'

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true })
  const rpc = new RPCHandler(router)

  app.get('/health', async () => ({ ok: true, service: 'takt-api' }))

  // Better Auth reads the raw request stream, so opt its routes out of Fastify's JSON parsing.
  app.addContentTypeParser('application/json', (_req, _payload, done) => done(null, null))

  app.all('/api/auth/*', async (request, reply) => {
    await toNodeHandler(auth)(request.raw, reply.raw)
    reply.hijack()
  })

  app.all('/api/v1/rpc/*', async (request, reply) => {
    const context: TaktContext = {
      db,
      reqHeaders: new Headers(request.headers as Record<string, string>),
    }
    const { matched } = await rpc.handle(request.raw, reply.raw, { prefix: '/api/v1/rpc', context })
    if (matched) reply.hijack()
    else reply.code(404).send({ error: 'not_found' })
  })

  return app
}
