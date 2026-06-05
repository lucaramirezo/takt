# takt: project rules and domain canon

takt is a Deskless Operations OS: time tracking and operations forms, fused, for businesses whose people are not at desks. The name is the lean-manufacturing term *takt time* (the production cadence matched to demand). This file is rules and canon only, never status or progress. House style: no em-dashes in any product copy.

## Product canon

### Worker archetypes (the design partner, a Miami large-format print/sign shop, has all five)
| Archetype | Where | Primary clock mode |
|---|---|---|
| Machine operators | fixed station, shop floor | kiosk (PIN) or NFC tap |
| Remote installers | rotating client sites | geofenced remote + photo + offline |
| Design artists | office / desk | in-app button or office NFC |
| Finance | office / desk | in-app button or office NFC |
| Delivery drivers | on the road | mobile + per-stop verification |

### The four clock modes
`in_app`, `kiosk` (shared tablet, device-bound, per-punch PIN), `nfc` (phone-reads-tag; opaque station id), `remote` (geofenced, GPS + accuracy + photo + time-window).

### US labor rules (data-driven; Florida + federal is the first rule set)
- Federal FLSA: overtime = 1.5x over 40 hours per WEEK (weekly, not daily).
- Florida follows federal: NO state daily overtime, NO state-mandated meal/rest breaks.
- Breaks are unpaid only if bona-fide (>= 20 min, uninterrupted). The system must detect break-vs-work overlap.
- The rules engine is data-driven per org/jurisdiction. Never hardcode rules; multi-state (e.g. California daily OT + meal penalties) must be config, not a rewrite.

### Geofencing and remote verification
- A geofence = center lat/lng + radius (meters) + optional polygon, owned by the org, assignable per person / per assignment / per site. Managers draw zones; "remote ops enabled" is toggled per assignment.
- Evaluation is hybrid: on-device OS region monitoring for cheap background enter/exit; SERVER-side authoritative evaluation at every punch. Never trust a client "in-zone" boolean or a client timestamp.
- Accuracy gate: flag/reject GPS fixes coarser than ~50-75m. Store accuracy on every punch.
- Verification is GOOD-FAITH PROOF + AUDIT TRAIL, never sold as tamper-proof. Default posture is FLAG-AND-REVIEW, not hard-block. Anything suspicious routes to a human (manager), it does not silently auto-reject.

## Non-negotiable data rules
- `time_entry` is APPEND-ONLY and immutable. The timesheet is a projection of the event log. Corrections are NEW adjustment rows referencing the original. US labor records must be reconstructible.
- Every punch carries a client-generated UUID (`client_uuid`) as an idempotency key, so offline replays and retries never double-count. The server is the only writer of derived state and assigns authoritative time (`recorded_at_server`); the client time is kept only for drift/dispute display.
- `audit_log` is APPEND-ONLY and records every manual edit, geofence change, role change, and approval. It powers the "manual edit" irregularity and is the dispute record.

## Architecture
Expo native universal app (worker + kiosk) + Next.js admin, sharing one oRPC API + Better Auth (org plugin) + a single Postgres with Row-Level Security. Native is required: background geofencing, NFC, and kiosk lockdown are impossible/unreliable in a browser.

```
apps/web        Next.js 15 (App Router) owner/manager cockpit (:3001)
apps/mobile    Expo (React Native) worker + kiosk app (one binary; kiosk = device-bound mode)
apps/api        Fastify entry: mounts Better Auth + the oRPC handler (:3000)
packages/api    oRPC contracts + middleware + context
packages/auth   Better Auth config (org plugin, permission statements)
packages/db     Drizzle schema + migrations + RLS policies + client
packages/domain Zod schemas + pure derive helpers (labor-rule math lives here later)
packages/ui-tokens  @takt/ui-tokens design tokens (web + native)
ops/            docker-compose (dev + vpsus) + Caddy
```

### RBAC + RLS (two enforcement layers)
- Better Auth org plugin gives multi-tenant identity + membership + roles. Org member roles: `owner`, `manager`, `people_manager`, `employee`. Permission statements gate oRPC procedures (verbs like `timesheet:approve`, `punch:edit`, `geofence:write`, `export:run`, `employee:manage`, `irregularity:resolve`).
- Postgres RLS keyed on `org_id` is the HARD second layer. Every mutation runs inside a transaction that does `SET LOCAL ROLE takt_api` and sets GUCs `app.org_id`, `app.user_id`, `app.member_role`; RLS policies read them via `current_setting('app.*', true)`. The kiosk uses a distinct, revocable, org+site-scoped device token; per-punch identity is a PIN layered on it.

## Critical gotchas (replicated from the KULT sibling; verify before you trust)
- BETTER AUTH IDS ARE STRINGS. All `user_id` / `org_id` FK columns are `text`, NOT `uuid`. UUID breaks the Better Auth adapter.
- BARE ENUM NAMES. Drizzle generates bare pg enum names (`clock_source`, not `clock_source_enum`). Hand-written manual SQL must use bare names; `grep -c "_enum" migration.sql` should be 0.
- WSL2 PORT 5432 is silently dropped; local Postgres is published on 15432 -> 5432 everywhere. Before any `db:generate`, `db:migrate`, or test run, verify DB availability with: `pg_isready -h localhost -p 15432 && echo DB_READY`. If not ready, run `pnpm up` first.
- NEW-TABLE GRANTS: `takt_api` is a non-superuser (no BYPASS RLS). After `drizzle-kit migrate`, apply the manual SQL in `packages/db/migrations/manual/` for RLS policies + GRANTs. Default privileges auto-grant future tables (see the role migration).
- oRPC OUTPUT SCHEMAS STRIP FIELDS: any handler-returned field not declared in the output Zod schema is silently dropped. Declare every field you return.
- DRIZZLE NULLABLE COLUMNS RETURN `null`, NOT `undefined`. oRPC context fields typed as `?: string` expect `string | undefined`. When reading a nullable Drizzle column into context, coerce with `?? undefined` (e.g. `siteId: device.siteId ?? undefined`). Missing this coercion produces a type error at the `next({ context })` call.
- BETTER AUTH `auth.api.*` CALLS TRAVERSE THE DRIZZLE ADAPTER AT RUNTIME. The adapter maps internal model names to Drizzle schema keys. The org membership model's internal name is `'member'`, not `'orgMembers'`. If an `auth.api.*` call throws `The model "X" was not found in the schema object`, the adapter's modelName is mismatched — this is a RUNTIME error, not a TypeScript error. Recommended fallback: use a direct DB write (e.g. `db.update(session).set({ activeOrganizationId }).where(eq(session.userId, userId))`) to set session fields instead of routing through `auth.api`.
- GRANT STATEMENTS ARE NOT IDEMPOTENT UNDER CONCURRENT GLOBAL-SETUPS. `IF NOT EXISTS` and `CREATE OR REPLACE` guards make schema DDL safe to run twice, but GRANT statements contend on catalog rows regardless and will throw `tuple concurrently updated` when two test suites run global-setup in parallel against the same Postgres. Two safe options: (a) Wrap every GRANT in a DO block: `DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO takt_api; EXCEPTION WHEN duplicate_object THEN NULL; END $$` (b) Serialize the test suites in turbo.json via `dependsOn` (see the Turbo override gotcha below). DO NOT conclude a global-setup is concurrency-safe from DDL guards alone — verify GRANTs separately.
- TURBO PACKAGE-SPECIFIC TASK ENTRIES FULLY REPLACE THE BASE PIPELINE TASK. A `"@pkg#task"` entry in `turbo.json` overrides (does not merge with) the base `"task"` pipeline entry. Any `dependsOn` from the base task is silently dropped unless re-declared explicitly. When adding a package-specific `dependsOn` (e.g. for test serialization), always re-declare `"^build"` too: `"@takt/api-server#test": { "dependsOn": ["^build", "@takt/api#test"] }`. Omitting `"^build"` passes today only if all deps happen to be built transitively by another task — a coincidence that breaks silently when dep trees diverge.
- CRYPTO HELPERS IN `lib/crypto.ts` ARE THE SINGLE SOURCE. Never inline `createHash`, `scrypt`, or `randomBytes` logic in service or builder files — always import and call the named helper (e.g. `hashDeviceToken(token)`, not `createHash('sha256').update(token).digest('hex')`). This prevents algorithm drift between the storage and lookup sides.
- `timingSafeEqual` THROWS ON UNEQUAL-LENGTH BUFFERS. Always pass equal-length buffers. When the caller controls `keylen` (e.g. `scryptAsync(input, salt, expected.length)`), lengths are equal by construction — the guard `derived.length === expected.length` is redundant. When the caller does NOT control length (e.g. comparing two user-supplied hex strings), the length guard IS required before calling `timingSafeEqual`.
- R2 IS DEFERRED: object storage (site-check-in photos) is wired only when the remote-clock photo feature lands (Phase 1). Do not add the aws-sdk dependency until then.
- UNUSED VARIABLES IN TESTS: prefix with `_` (e.g. `_profileB`) — the ESLint `varsIgnorePattern: '^_'` rule suppresses them. Never use `void expr` as a lint workaround.
- RLS VITEST ASSERTIONS: assert RLS `WITH CHECK` violations as `.rejects.toMatchObject({ cause: { code: '42501' } })` — Drizzle wraps postgres.js errors as `DrizzleQueryError { cause: PostgresError { code } }`. A regex on the message string is fragile by comparison; `'42501'` is the stable SQLSTATE for `INSUFFICIENT_PRIVILEGE`.

## Design system (locked)
"Precision / Takt Grid" personality on the shadcn `luma` preset. Init the admin with `npx shadcn@latest init --preset luma`. Warm-paper light theme (bg `#FBFAF8`, ink `#1A1916`) + andon-orange accent `#E8590C` (live/CTA ONLY, never warning); success `#2F7D54`, warning `#B86E00`, danger `#C0392B`; dark "cockpit" peer theme `#16150F`. Fonts: Space Grotesk (heading) + Inter (body) + JetBrains Mono (all numerics, tabular). Icons: Phosphor (Regular, stroke 1.5), one library only. Tokens are the single source in `@takt/ui-tokens` feeding shadcn-web and NativeWind-native. Full spec: see the lwiki artifact `drafts/artifacts/2026-06-04/takt/design/design-system.md`.

### shadcn CLI — operational facts (verified against luma preset)
- `npx shadcn@latest init --yes --preset luma` **silently merges** luma vars into `globals.css` — the interactive "overwrite?" prompt never appears with `--yes`. It overwrites `--background`, `--foreground`, `--primary`, `--accent`, `--destructive`, `--font-heading`, and others with luma oklch/font-sans values, while preserving takt-only vars (`--surface`, `--success`, `--warning`, `--danger`).
- **CSS ordering**: takt palette overrides MUST appear AFTER the luma variable block, not before it. CSS last-declaration wins; inserting before the luma block means luma silently wins. After init, append takt values at the bottom of each CSS block (`:root`, `.dark`).
- **Font var**: luma overwrites `--font-heading` with `var(--font-sans)`. After init, restore it to `var(--font-space-grotesk)`. Audit with: `grep -n 'font-heading' apps/web/src/app/globals.css`.
- **`--accent` vs `--primary`**: luma repurposes `--accent` for neutral hover fills (near-white in light, dark gray in dark mode) — NOT the orange brand color. Andon-orange (`#E8590C`) maps to `--primary` (luma's `Button variant="default"` CTA token). NEVER assign orange to `--accent`; it would render near-invisible in light mode and flood hover states.
- **Post-CLI dep audit** (after any `shadcn init` or `shadcn add`): run `grep -E '"lucide|react-icons|heroicons"' apps/web/package.json` and remove any hit (Phosphor is the only icon library). Also verify `shadcn` is in `devDependencies`, not `dependencies` — it is a scaffolding CLI with no runtime role.

## Dev
- `pnpm install` then `pnpm up` (starts Postgres + Redis via `ops/docker-compose.dev.yml`).
- `pnpm --filter @takt/db db:generate` then `db:migrate`, then apply `packages/db/migrations/manual/*.sql` for RLS + roles.
- `pnpm dev` runs all apps via turbo. Admin on :3001, api on :3000, Expo on :8081.
- `pnpm check-types` and `pnpm lint` must pass before any commit. When changes touch `apps/web`, also run `pnpm --filter @takt/web build` — Next.js build failures are not caught by `check-types` or `pnpm test`.
- Before implementing any feature, run `pnpm check-types && pnpm lint` and note any pre-existing failures. Fix pre-existing failures in a separate commit before the feature work begins; do NOT widen their fix beyond the minimum required to make the baseline green.

## Build process
Built feature-by-feature via the Archon `piv-system-evolution` PIV loop (plan -> implement -> validate, four human gates -> draft PR). Foundational slices (data model, roles, RLS) land before clock modes; geofence + overtime features get the heaviest gate scrutiny. Decompose work into PR-sized GitHub issues. See the PRD: `drafts/artifacts/2026-06-04/takt/takt-prd.md` in the lwiki vault.
