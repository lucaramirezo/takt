import { defineConfig } from 'drizzle-kit'
import { env } from './src/env'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: { url: env.DATABASE_URL },
})
