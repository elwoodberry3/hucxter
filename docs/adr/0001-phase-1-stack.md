# ADR-0001: Phase I stack
**Status:** Accepted (Founder, D-02, 2026-10-23). Amended the same day by ADR-0008 (desktop web
only; Expo removed).

## Context
Small team, video listings, geospatial queries, and a Phase I audience made up of the internal QA team
using **desktop Chrome**. The superseded draft listed about 10 services, including Prisma,
Qdrant/pgvector, R2, and Upstash Redis.

## Decision
- **pnpm workspaces monorepo**:
  - `apps/web` is a Next.js App Router app holding the user-facing web app, API route handlers, and
    a role-gated `/admin` console, deployed on Vercel.
  - `packages/contracts` holds the zod schemas and types.
  - `supabase/` holds migrations and tests.
- **Supabase**: Postgres + PostGIS, Auth (phone OTP, SSR cookie sessions), Realtime for chat, SQL-first
  migrations via the Supabase CLI, and RLS on every table.
- **Mux** for video (ADR-0003) and the **Anthropic API** for the AI listing draft (ADR-0005).
- **Single write path**: all mutations go through server code in `apps/web`.
- **No** Prisma, vector DB, Redis, Kubernetes, microservices, or native/mobile frameworks in Phase I.

## Why
A modular monolith in one language (TypeScript) is the fastest path for a small team. A single
Next.js app now covers the UI, API, and admin. Postgres + PostGIS covers geo, relational data,
queues (ADR-0004), and rate limits. Prisma would force raw SQL for every geo query.

## Alternatives
- Supabase-only (browser → PostgREST + Edge Functions): fewer moving parts, but business rules end
  up split across RLS, SQL, and edge functions, which is harder to review.
- Separate frontend and API services: two deployables with no Phase I benefit.
- Expo / React Native: removed by ADR-0008. Native iOS comes in Phase V.

## Consequences
One deployable (Vercel) plus managed services. When the Phase IV desktop app and Phase V iOS app
arrive, they call the same API using the same `packages/contracts`.

## Verify at implementation
Current stable Next.js version; `@supabase/ssr` cookie setup; Supabase CLI PostGIS extension;
Vercel region close to the Supabase region.
