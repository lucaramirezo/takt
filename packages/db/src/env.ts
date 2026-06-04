import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  throw new Error(`Invalid @takt/db env: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`)
}

export const env = parsed.data
