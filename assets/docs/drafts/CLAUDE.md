# CLAUDE.md - HUCXSTER Engineering Blueprint

## Product Summary
HUCXSTER is a hyper-local (max 100-mile radius), video-first, zero-shipping social marketplace powered by AI valuation and negotiation agents.

## Core Tech Stack
- Frontend: Next.js 15+ (App Router), Tailwind CSS (Neubrutalism theme), Framer Motion, React Native (Expo)
- Backend & DB: PostgreSQL + PostGIS (Geospatial indexing), Supabase / Prisma ORM
- Storage & Media: Cloudflare R2 / Mux (HLS short-form video streaming pipeline)
- AI & Vector: Anthropic Claude 3.5 Sonnet / Haiku (Multimodal valuation & negotiation agents), Qdrant / Pgvector
- Infrastructure: Vercel, Supabase, Redis (Upstash for real-time chat & rate-limiting)

## Architectural Guarantees & Constraints
1. Zero Shipping Logic: Every query, database view, and feed API MUST enforce the strictly bounded `100-mile radius` geo-fence using PostGIS `ST_DWithin`.
2. High-Trust Verification: All chat initialization endpoints MUST pass through the zero-bot auth verification layer before a buyer/seller thread opens.
3. Subcultural Neubrutalist UI: Hard borders (`3px-4px`), zero Gaussian blur shadows (`4px 4px 0px #000`), neon high-contrast visual tokens.
4. Multimodal First: AI valuation endpoints accept image frames/video clips and return fair market value ranges with confidence intervals.

## Core Development Commands
- `npm run dev`: Start local development server (Next.js + Supabase local)
- `npm run test`: Run full test suite (Jest + Playwright E2E)
- `npm run test:geo`: Execute PostGIS geo-fencing spatial query tests
- `npm run lint`: Enforce ESLint, Prettier, and TypeScript strict checks
- `npx prisma db push`: Sync Prisma schema updates to development database

## Code Style & Formatting
- Use TypeScript strict mode everywhere; no `any` types.
- Server Components by default; explicit `'use client'` only for active video touch handlers or gesture overlays.
- Export modular subcomponents under `@/components/ui/` or `@/components/marketplace/`.
- Handle spatial location errors gracefully with fallback neighborhood pins.