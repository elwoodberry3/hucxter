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
| `pnpm build`     | Production build of every workspace (`APP_ORIGIN` must be set when it runs)         |
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

## Storefront (Brief 02): running locally

The storefront reads categories and ZIP areas from the **local** Supabase database, so start it
before `pnpm dev` or `pnpm test:e2e`:

```sh
supabase start && supabase db reset   # migrations + seed (taxonomy, North Texas ZIP areas)
supabase status                       # copy API_URL and PUBLISHABLE_KEY into apps/web/.env.local
pnpm dev
```

`apps/web/.env.local` needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (the publishable key only,
never the secret/service-role key), `APP_ENV=local`, and `DEFAULT_AREA_ZIP` (see
`apps/web/.env.example`). `pnpm test:e2e` reads the Supabase values from `supabase status` itself.

| Route                                            | Notes                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `/`                                              | Home = Feed: hero, categories, near-you rails, house promos. No listings exist yet |
| `/c/[dept]`, `/c/[dept]/[sub]`                   | Category index with filters in the URL                                             |
| `/search?q=`                                     | Search results (same layout)                                                       |
| `/sign-in`, `/sign-up`                           | UI only until Brief 03                                                             |
| `/sell`, `/messages`, `/saved`, `/listings`, ... | Redirect guests to `/sign-in?next=…`                                               |
| `/dev/templates/listing`                         | Product page template with a **Demo** fixture; 404 when `APP_ENV=production`       |

Never add fake listings, counts, ratings, or scale claims. Demo data lives only under `/dev`.
