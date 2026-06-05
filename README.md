# takt

A Deskless Operations OS: time tracking and operations forms, fused. For businesses whose people are not at desks (operators, field installers, office staff, drivers). The name is the lean-manufacturing term *takt time*: the production cadence matched to demand.

> Status and roadmap live in the PRD, not here. This README is setup only.

## Stack
- Monorepo: pnpm + turbo (Node >= 22)
- Web admin: Next.js 15 (App Router), Tailwind v4, shadcn `luma` preset
- Worker + kiosk: Expo (React Native) + NativeWind
- API: Fastify mounting Better Auth (org plugin) + an oRPC handler
- Data: Drizzle ORM + Postgres 16 with Row-Level Security
- Storage: Cloudflare R2 (deferred until the photo feature lands)
- Deploy: Docker + Compose on vpsus behind Caddy (same infra as KULT)

## First-time setup

```bash
pnpm install

# start local Postgres (+ Redis) on host port 15433
pnpm up

# generate + apply the schema, then the manual RLS/role SQL
pnpm --filter @takt/db db:generate
pnpm --filter @takt/db db:migrate
# then apply each packages/db/migrations/manual/*.sql against the dev db

cp .env.example .env   # fill in BETTER_AUTH_SECRET etc.
pnpm dev               # admin :3001, api :3000, expo :8081
```

## Finalize the app scaffolds (run once)
The backend packages are fully scaffolded. The two app shells are minimal and are finalized with their own CLIs:

```bash
# Web: pull shadcn luma components into apps/web
cd apps/web && npx shadcn@latest init --preset luma && npx shadcn@latest add button card table badge

# Mobile: finalize the Expo dev-build (geofencing/NFC/kiosk need a dev-build, not Expo Go)
cd apps/mobile && npx expo install && npx expo prebuild
```

## Layout
See `CLAUDE.md` for the domain canon, RBAC/RLS pattern, labor rules, and the critical gotchas (text FK ids, bare enum names, WSL2 15433 port, R2 deferred).

## Build
Feature-by-feature via Archon `piv-system-evolution`, foundational slices first. PRD: in the lwiki vault at `drafts/artifacts/2026-06-04/takt/takt-prd.md`.
