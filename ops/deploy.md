# Deploy (vpsus)

takt deploys on vpsus (198.71.56.218) as Docker containers behind Caddy, mirroring the KULT routine.
Self-hosted Postgres 16 is the system of record. Cloudflare R2 (object storage) is wired only when the
remote-clock photo feature lands. Secrets live on the box at `/etc/takt/*.env` (mode 600), never committed.

## One-time box setup
1. `mkdir -p /etc/takt /opt/takt` ; create `/etc/takt/postgres.env` and `/etc/takt/api.env` (DATABASE_URL,
   BETTER_AUTH_SECRET, BETTER_AUTH_URL, CORS_ALLOWLIST, and later the R2_* keys).
2. Point DNS for the API hostname at vpsus and set it in `ops/vpsus/caddy/Caddyfile`.

## Release (same shape as KULT: rsync -> build -> recreate, with a rollback tag)
```bash
# from the repo root, build the api image context and ship it
rsync -az --delete --exclude node_modules --exclude .git ./ vpsus:/opt/takt/src/
ssh vpsus 'cd /opt/takt/src && docker build -f apps/api/Dockerfile -t takt-api:$(date +%Y%m%d-%H%M) -t takt-api:latest .'
# run migrations (drizzle-kit migrate + the manual RLS SQL) then recreate
ssh vpsus 'cd /opt/takt/src && docker compose -f ops/vpsus/docker-compose.yml up -d --no-deps api caddy'
```
Keep the previous `takt-api:<timestamp>` tag so a rollback is `docker tag` + `compose up -d api`.

## Migrations on the box
```bash
pnpm --filter @takt/db db:migrate
# then apply each packages/db/migrations/manual/*.sql against the prod db (RLS + takt_api role)
```
