# Hucxter

A hyperlocal, video-first marketplace. Sellers post a short video of an item, nearby buyers find it
in a local feed and message the seller, and they meet in person. Phase I is a **desktop web app**
for current desktop Chrome.

Project rules live in [`CLAUDE.md`](CLAUDE.md), decisions in [`docs/adr/`](docs/adr/), and the
roadmap in [`docs/strategy/phased-roadmap.md`](docs/strategy/phased-roadmap.md).

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- pnpm 12 (`corepack enable` picks up the version pinned in `package.json`)
- Docker Desktop, running (for local Supabase)
- Supabase CLI 2.122+
- Google Chrome (reference browser)

## Quickstart

```sh
pnpm install
cp apps/web/.env.example apps/web/.env.local   # local values only; never commit .env files
pnpm dev                                       # http://localhost:3000
curl http://localhost:3000/api/health          # {"status":"ok","version":"…","commit":"…"}
```

Local database (Docker; never linked to a remote project):

```sh
supabase start      # first run pulls images
supabase db reset   # rebuild from supabase/migrations
supabase test db    # pgTAP tests in supabase/tests
supabase stop
```

Before the first e2e run, install the Playwright browser once:

```sh
pnpm --filter @hucxter/web exec playwright install chromium
```

## Scripts

| Command          | What it does                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`       | Next.js dev server for `apps/web`                                                   |
| `pnpm build`     | Production build of every workspace (needs `APP_ORIGIN` set)                        |
| `pnpm lint`      | ESLint in every workspace (warnings fail)                                           |
| `pnpm typecheck` | `tsc --noEmit` in every workspace                                                   |
| `pnpm test`      | Vitest unit tests                                                                   |
| `pnpm test:e2e`  | Playwright (Chromium) at 1440×900 and 1280×800, with axe and security-header checks |
| `pnpm test:db`   | `supabase test db` (run `supabase start` first)                                     |
| `pnpm format`    | Prettier write (`format:check` runs in CI)                                          |

## Layout

```
apps/web/             Next.js App Router: UI, API route handlers, /admin
  src/app/(shell)/    Sidebar + toolbar shell and its pages
  src/app/api/        Route handlers (/api/health)
  src/proxy.ts        Per-request nonce Content-Security-Policy
  e2e/                Playwright tests
packages/contracts/   zod schemas and types shared by the web app and future clients
supabase/             config, migrations, pgTAP tests
assets/               Brand and design references (not shipped)
docs/                 ADRs, roadmap, briefs
```

## Environment

Each workspace documents its variables in `.env.example`. Only `NEXT_PUBLIC_*` values reach the
browser, and none are secret. CI uses no production credentials.
