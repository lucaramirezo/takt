import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWLIST: z.string().default('http://localhost:3001,http://localhost:8081'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid @takt/api-server env:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
