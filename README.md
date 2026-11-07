# Hucxter

A hyperlocal, video-first marketplace. Sellers post a short video of an item, nearby buyers find it
in a local feed and message the seller, and they meet in person. Phase I is a **desktop web app**
for desktop and mobile browsers (mobile first, ADR-0011).

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
pnpm --filter @hucxter/web exec playwright install chromium webkit
```

## Scripts

| Command          | What it does                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`       | Next.js dev server for `apps/web`                                                                                                          |
| `pnpm build`     | Production build of every workspace (`APP_ORIGIN` must be set when it runs)                                                                |
| `pnpm lint`      | ESLint in every workspace (warnings fail)                                                                                                  |
| `pnpm typecheck` | `tsc --noEmit` in every workspace                                                                                                          |
| `pnpm test`      | Vitest unit tests                                                                                                                          |
| `pnpm test:e2e`  | Playwright: desktop Chromium 1440×900 / 1280×800, Pixel 7 (Chromium), iPhone 15 (WebKit); axe, CSP and header checks. Needs local Supabase |
| `pnpm test:db`   | `supabase test db` (run `supabase start` first)                                                                                            |
| `pnpm format`    | Prettier write (`format:check` runs in CI)                                                                                                 |

## Layout

```
apps/web/             Next.js App Router: UI, API route handlers, /admin
  src/app/(store)/    Storefront pages (home, categories, search, /l, /sell, /listings, /admin)
  src/server/         Server-only code: auth, listings, media (Mux seam), jobs, events
  src/app/api/        Route handlers (health, Mux webhooks, cron jobs, view beacon)
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
supabase start && supabase db reset   # migrations (taxonomy, all US ZIP areas, launch area) + local seed
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
| `/sign-in`, `/sign-up`                           | Email code or Google (3B); new accounts continue to `/welcome`                     |
| `/sell`, `/messages`, `/saved`, `/listings`, ... | Guests → `/sign-in?next=…`; unverified members → `/welcome?next=…`                 |
| `/l/[id]`                                        | Listing page (3C.1); hidden, removed or unknown listings are 404                   |

Never add fake listings, counts, ratings, or scale claims.

## Mobile web and nationwide ZIPs (Brief 03, Milestone 3A)

- **Mobile first** (ADR-0011): below 64rem the app uses a compact header, scrollable category
  chips with an "All categories" sheet, a bottom tab bar (Home · Discover · Sell · Inbox ·
  Account), a FilterDrawer and sticky product actions. Primitives live in
  `apps/web/src/components/ui/` (BottomSheet, TabBar, Toast, Skeleton, EmptyState, ErrorState).
  Elevation uses `--z-*` tokens only.
- **Reference data is migrated, not seeded:** every 2020 ZCTA for the 50 states, DC and Puerto
  Rico (`postal_areas`), the category taxonomy, and the Portland–Vancouver launch area
  (`service_areas`). `supabase/seed.sql` is for local demo data only. Regenerate ZIP data with
  `supabase/scripts/build_postal_areas.py` (instructions in the file).
- **Default location** is ZIP 97205 (`DEFAULT_AREA_ZIP`). Any US ZIP can be set; outside the launch
  area a dismissible notice explains where Hucxter is starting.
- Test on phones too: `pnpm test:e2e` runs the mobile projects; for real devices see
  `docs/standards/mobile-experience-standard.md` §14.

## Accounts and verification (Brief 03, Milestone 3B)

- **Sign in** with a 6-digit email code or Google (D-34). Facebook and TikTok sign-in are gone.
- **Verified member** = confirmed email, verified US mobile number (SMS code), 18+ attestation,
  home ZIP and, when `INVITE_ONLY=true`, an invite. `/welcome` walks through the missing steps and
  resumes after a reload. Every gated page and action uses `requireVerifiedMember()`
  (`apps/web/src/server/auth/gate.ts`); every mutation checks `Origin` first.
- **Settings** (`/settings`): profile, phone change, signed-in devices (no IP addresses), sign out
  everywhere, delete account.
- **Local testing:** codes arrive in Mailpit (http://127.0.0.1:54324). Test numbers
  +1 503 555 0100–0139 take code `123456` (`supabase/config.toml`). Invites, the first admin,
  OTP limits and the cloud settings for QA are in `docs/runbooks/accounts.md`.
- **Variables** (`apps/web/.env.local`, never committed): `SUPABASE_SECRET_KEY` (server only; used
  for account deletion, audit entries and OTP limits), `INVITE_ONLY`, `CAPTCHA_PROVIDER`
  (`turnstile` | `none`; `none` is refused in production), `TURNSTILE_SITE_KEY`,
  `TURNSTILE_SECRET_KEY`.

## Listings and selling (Brief 03, Milestone 3C.1)

- **Sell** (`/sell`): record or choose a video (up to 60 s), describe the item, review, publish.
  "Publish when ready" posts it as soon as the video finishes processing. The draft is saved in
  the database, so a reload resumes the same step.
- **Listing page** (`/l/[id]`): Mux Player with signed playback, price (with "Price dropped" only
  under the D-45 rule), status, distance bucket and area, seller card, Meet safely. Messaging is
  still disabled ("Is this still available?" arrives in 3C.2). Owners get Edit, Mark pending,
  Mark sold and Delete.
- **My Listings** (`/listings`): Drafts · Processing · Live · In review · Sold. **Report** sheet on
  every listing; staff review reports and held listings in `/admin`.
- **Discovery:** home rails, categories and search read live listings within the viewer's radius
  (1, 5, 10, 25, 50 or 100 mi). Browsers never see a precise location.
- **Video locally** uses a fake provider (no Mux account needed). Real Mux setup, variables, manual
  phone QA and troubleshooting: [`docs/runbooks/video.md`](docs/runbooks/video.md).
- **Variables** (server only, never committed): `VIDEO_PROVIDER`, `MUX_TOKEN_ID`,
  `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`,
  `MEDIA_MAX_SECONDS`, `MEDIA_MAX_BYTES`, `CRON_SECRET`.
