# takt API. Runs tsx directly against the workspace source (no compiled dist), like the KULT sibling.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install workspace deps (full repo context; refine with `turbo prune` when it matters).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile || pnpm install

EXPOSE 3000
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@takt/api-server", "start"]
