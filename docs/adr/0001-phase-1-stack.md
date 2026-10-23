# ADR-0001: Phase I stack
**Status:** Accepted (Founder, D-02, 2026-10-23) · **Proposed:** 2026-10-22

## Context
Small team, mobile-first video capture, geospatial queries, Phase I audience is an internal QA team.
The draft stack listed ~10 services including Prisma, Qdrant/pgvector, R2 and Upstash Redis.

## Decision
- **pnpm workspaces monorepo**: `apps/mobile` (Expo / React Native), `apps/web` (Next.js App Router:
  API route handlers + internal admin console, deployed on Vercel), `packages/contracts` (zod).
- **Supabase**: Postgres + PostGIS, Auth (phone OTP), SQL-first migrations via Supabase CLI, RLS on.
- **Single write path**: all mutations via `apps/web` API; clients read via the API too in Phase I.
- **No** Prisma, vector DB, Redis, Kubernetes, or microservices in Phase I.

## Why
Modular monolith in one language (TypeScript) is the fastest path for a small team. Postgres +
PostGIS covers geo, relational data, queues (ADR-0004) and rate limits. Prisma would force raw SQL
for every geo query. One API layer keeps authorization and validation in one place.

## Alternatives
- Supabase-only (client → PostgREST + Edge Functions): fewer moving parts, but business rules split
  across RLS, SQL and edge functions; harder to review.
- Native Swift/Kotlin: best camera performance, two codebases. Revisit if Expo camera/upload fails QA.
- Web-first PWA: camera/upload UX and background upload are weaker; not suited to video capture.

## Consequences
Two deployables (Vercel API, Expo app). Next.js 16.x and Expo SDK 56 both target React 19.2 as of
this date, so one React version can be pinned across the monorepo — re-verify at kickoff.

## Verify at implementation
Current stable Next.js and Expo SDK versions; Supabase CLI PostGIS extension setup; Vercel region
close to the Supabase region.
