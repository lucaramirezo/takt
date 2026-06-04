import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export default async function setup() {
  const url = process.env.DATABASE_URL ?? 'postgresql://postgres:dev@localhost:15432/takt'

  // Step 1: run drizzle migrator to create/update schema (idempotent; drizzle owns migrations)
  const migrationClient = postgres(url, { max: 1 })
  try {
    const db = drizzle(migrationClient)
    await migrate(db, { migrationsFolder: resolve(process.cwd(), '../db/drizzle') })
  } finally {
    await migrationClient.end()
  }

  // Step 2: apply manual RLS/roles SQL idempotently in sorted order (requires tables to exist, hence after migrate)
  const manualDir = resolve(process.cwd(), '../db/migrations/manual')
  const files = readdirSync(manualDir).filter((f) => f.endsWith('.sql')).sort()
  const sql = postgres(url, { max: 1 })
  try {
    for (const file of files) {
      await sql.unsafe(readFileSync(resolve(manualDir, file), 'utf8'))
    }
  } finally {
    await sql.end()
  }
}
