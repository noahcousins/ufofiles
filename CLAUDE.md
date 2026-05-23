# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`[ufo]files` (package name `ufofiles`) — a Next.js app for searching, browsing, and downloading declassified government UFO/UAP files. Files and their metadata live in Postgres; the actual binary assets live in Cloudflare R2 and are served by a separate Cloudflare Worker.

## Commands

Package manager is **pnpm**.

```bash
pnpm dev          # next dev --turbopack
pnpm build        # next build
pnpm lint         # biome check .
pnpm format       # biome check --fix .  (auto-fix + format)
pnpm typecheck    # tsc --noEmit

# Database (Drizzle + Postgres). Scripts load .env.local automatically.
pnpm db:push      # push schema to DB (no migration files)
pnpm db:generate  # generate SQL migration from schema diff
pnpm db:migrate   # apply migrations in drizzle/
pnpm db:seed      # tsx scripts/seed-db.mts
pnpm db:studio    # drizzle-kit studio

# Cloudflare Worker (the file server)
pnpm worker:dev
pnpm worker:deploy

# Scrape/ingest pipeline (see "Scrape pipeline" below)
pnpm scrape                 # run all steps via scripts/scrape/run-all.ts
pnpm scrape:csv .. :link    # run an individual numbered step
```

There is **no test framework** configured (Playwright is a dependency but no `test` script exists).

## Conventions

- **Biome via `ultracite`** is the formatter/linter (`biome.jsonc` extends `ultracite/biome/{core,react,next}`). **Semicolons are `asNeeded`** — do not add trailing semicolons. Format-on-save and `source.fixAll.biome` are configured in `.vscode/settings.json`.
- **Zod is v4**: routers import from `"zod/v4"`.
- `@/*` path alias maps to the repo root.
- The Worker has its own `worker/tsconfig.json` and is **excluded from the root `tsconfig.json`** (`include`/`exclude`).

## Architecture

### Data model (`lib/db/schema.ts`)
`releases` → `files` (one-to-many). `files` ↔ `tags` is many-to-many through `file_tags`. `events` records views (one row per view, with IP). `release_downloads` holds bulk-download bundles per release. The `files` table has a **Postgres full-text GIN index** combining `title`/`description`/`incidentLocation`/`textContent` with weights A–C; search uses `websearch_to_tsquery`.

### tRPC stack (`lib/trpc/`)
Layered, and consumed two ways:
- `init.ts` — base `router`/`publicProcedure`, superjson transformer, context carries `clientIp`.
- `rateLimit.ts` — **all procedures use `rateLimitedProcedure(action, keyFn?)`**, not `publicProcedure` directly. It enforces Redis-backed limits by tier (`view`/`query`/`mutation`) and **degrades gracefully (allows the request) when Redis is unavailable**.
- `routers/{files,releases,telemetry}.ts` — combined in `router.ts` as `appRouter`.
- **Server (RSC) path**: `server.ts` exposes a server-side `caller` + `HydrateClient`. Pages call `void trpc.x.prefetch(...)` then render under `<HydrateClient>` (see `app/page.tsx`).
- **Client path**: `client.ts` + `provider.tsx` wire `httpBatchLink` → `/api/trpc`. The HTTP handler (`app/api/trpc/[trpc]/route.ts`) derives `clientIp` from `x-forwarded-for`/`x-real-ip`.

### Caching (`lib/cache.ts`)
Query resolvers wrap their work in `withCache(cacheKey(...), ttl, fetcher)` against Upstash Redis. Keys are versioned globally (`trpc:v{N}:...`); `bustCache()` increments the version to invalidate everything. **Cache keys carry an inline schema version suffix** (e.g. `files:list:v7`, `files:mimeTypeCounts:v5`) — bump that suffix when you change a query's result shape, otherwise stale cached payloads will be served.

### File serving is decoupled from the app
Postgres stores an `r2Key` prefixed by logical bucket (`source/`, `assets/`, `downloads/`). The app never reads R2 directly:
- `lib/file-url.ts` builds URLs against `NEXT_PUBLIC_WORKER_URL` and **derives asset-derivative paths by naming convention** (card thumbs, `pdf-pages/`, `video-stream/…_720p.mp4`, `video-thumbs/`, `video-previews/`). Source keys map to asset keys via `lib/r2-paths.ts` (`sourceToAssets`).
- `worker/index.ts` (deployed separately via `wrangler.json`) resolves the prefix to one of four R2 buckets (`R2_SOURCE`/`R2_ASSETS`/`R2_DOWNLOADS`/`R2_LEGACY`), handles HTTP Range requests, edge caching, IP rate limiting, and a legacy-key fallback. Bucket bindings are defined in `wrangler.json`.

### Scrape / ingest pipeline (`scripts/scrape/`)
Numbered steps `01`–`13`, each exporting `main()`. `run-all.ts` runs them in order and **stops on the first failure** (later steps depend on earlier outputs). Flow: fetch/parse CSV → download docs & videos → generate previews/thumbnails (pdftoppm, ffmpeg, sharp) → transcode → upload source & assets to R2 → link DB records. `config.ts` resolves the active release (`--release` flag > `RELEASE` env > `release-1`) and holds all tunables/paths; intermediate artifacts land in `ufo-files/{release}/` (gitignored).

### Frontend
App Router. The **homepage `app/page.tsx` is the file browser** (the `/files` route just `redirect`s to `/`; `/globe` redirects to `/map`). Filter/search state lives in the URL via **nuqs**. UI is **shadcn/ui** (style `base-lyra`, Phosphor icons) on **Tailwind v4**; theme defaults to dark. The changelog is **MDX** files in `content/changelog/*.mdx` parsed by `lib/changelog.ts` (gray-matter frontmatter). PostHog analytics is proxied through the `/ingest/*` rewrites in `next.config.ts`. `proxy.ts` is the Next middleware (bot detection for OG/file-share crawlers).

## Environment

Local dev needs `.env.local` (see `.env.example`): `DATABASE_URL`, the `R2_*` credentials/bucket names, `UPSTASH_REDIS_REST_*`, and `NEXT_PUBLIC_WORKER_URL`. `getFileUrl` **throws** if `NEXT_PUBLIC_WORKER_URL` is unset, and Redis-backed caching/rate-limiting silently no-op without the Upstash vars.

## Limitations

- Never run pnpm db:push, pnpm db:migrate, or pnpm db:seed. These scripts should only be run explicitly by the user.

## Workflow

- After making changes to the codebase, run `pnpm check` to ensure there are no type errors.