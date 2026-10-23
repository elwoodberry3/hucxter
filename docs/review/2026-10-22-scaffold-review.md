# Scaffold & Design Review — 2026-10-22

**Reviewer:** Advisory Board Chair · **Scope:** `elwoodberry3/hucxter@a596f41` (main) —
`assets/docs/drafts/*`, `assets/docs/fairxchange.md`, `assets/docs/hyper-local-video-marketplace.md`,
`assets/images/ui/hx.ui__1–12.png`, `.gitignore`.
**Not reviewed:** `hook-problem-solution.md` (slides). It wasn't present at review time; it was
reviewed separately on 2026-10-23 (`docs/pitch/copy-review.md`).

> **Later decisions (2026-10-23):** D-01–D-04, D-12–D-16, and the desktop-first platform sequence
> (ADR-0008) supersede parts of this review: Expo is removed from the stack, mobile-specific findings
> now apply to Phase V iOS, and the brand/domain mismatch is resolved by hucxter.app. Current state:
> `docs/decisions/open-decisions.md`.

Severity per governance Article XIII. Critical blocks release.

## Critical

| ID | Finding | Resolution in this change |
|---|---|---|
| C1 | **Seller location exposure.** Product spec shows exact distances ("3.2 miles away") and the draft query filters on the listing's precise point. Exact distance from several viewer positions trilaterates a seller's home — a physical-safety risk in a meet-in-person marketplace. | Two-point model (private precise point, public ~1 km display point), bucketed distances, column revokes. `hucxter-geo-radius`, ADR-0002. |
| C2 | **Credentials in a committed config, via an unmaintained server.** Draft `.mcp.json` embeds a Postgres connection string and uses `@modelcontextprotocol/server-postgres`, which was moved to the archived reference-servers repo in 2025 with no security guarantees. | `.mcp.json` now holds only a read-only, project-scoped Supabase dev MCP with the project ref injected from an env var. Local DB work uses the Supabase CLI. |

## High

| ID | Finding | Resolution |
|---|---|---|
| H1 | **Stack overreach / stale choices.** Draft lists Next.js + Expo + Supabase + Prisma + R2 + Mux + Qdrant/pgvector + Upstash Redis + "Claude 3.5". Prisma does not support PostGIS (geo columns become `Unsupported`, raw SQL only). Vector DB and Redis have no Phase I requirement. Model name is outdated. | ADR-0001 trims to Supabase (Postgres/PostGIS/Auth) + Next.js API/admin + Expo + Mux + Anthropic API (model IDs from env). |
| H2 | **Design direction contradiction.** Draft CLAUDE.md mandates neubrutalism (hard 3–4px borders, neon, hard shadows); every mockup is a soft, lavender, Apple-HIG style. Claude Code would build one and the investor deck would show the other. | **Resolved 2026-10-23 (D-03):** Apple HIG is the structural baseline for the whole platform; neubrutalism dropped. ADR-0007. |
| H3 | **Mockups depict the wrong product for Phase I.** Screens show brand retail flows — "Official Store", "In Stock", "Add to Bag", cart badges, "Marketplace orders", star ratings, strikethrough pricing, "Complete the Look". That is shipped e-commerce, which contradicts the zero-shipping P2P thesis. The Phase I core loop (record a listing, local feed with distance, item-linked chat, meetup, report/block) has no screen. | Roadmap lists the Phase I screens to design next. Mockups labeled in CLAUDE.md as layout reference only. |
| H4 | **Mockups are not investor-ready.** Visible AI-generation artifacts: garbled text ("Hwat Tines", "Elown Larns", "Connected (#66A51C"), irrelevant UI ("Recent emails" table, "Terminal Access" setup card, "Create New Project / Open Existing File" launcher), a non-HX logo in the Creator Studio screen, inconsistent nav (For You/Following/Explore/Marketplace/Shop/Discover/Communities vary per screen). Describing these as "pixel-perfect" to investors is a credibility risk. | **Resolved 2026-10-23 (D-04):** mockups are reference only; investor visuals will be captured from the working MVP. |
| H5 | **Valuation over-promise.** Spec promises fair-market ranges "with confidence intervals" from a 5-second video using "active local comps" — no comps data source exists, and a model cannot establish condition or value from video. | Price guidance off in Phase I; draft-listing assistant only. ADR-0005. |
| H6 | **"Sassy" buyer persona.** Calling a seller's price "highway robbery" in-product invites harassment complaints and seller churn on the supply side you most need. | Deferred to Phase II as opt-in, factual tone. |
| H7 | **"Zero-bot" guarantee.** Not achievable or provable; a public claim creates liability. | Reframed as layered bot resistance. Skill renamed `hucxter-trust-safety`. |

## Medium

| ID | Finding |
|---|---|
| M1 | Name was spelled four ways across repo, docs and the brief. Affects bundle IDs, domains, trademarks. **Resolved 2026-10-23 (D-01): Hucxter.** |
| M2 | Draft spatial query: no `ST_SetSRID`, no status/block filters, no `LIMIT`, no pagination. Replaced by `reference/feed-query.sql`. |
| M3 | Three of four skills are empty placeholders; the geo skill is wrapped in an outer markdown fence, so its frontmatter is not on line 1 (Claude Code then treats the whole file as content) and it is truncated mid-block. All six skills rewritten. |
| M4 | Filesystem MCP server is redundant — Claude Code has native file tools — and adds attack surface. Removed. |
| M5 | `npx prisma db push` as a standard command bypasses migration history. Replaced by SQL-first migrations. |
| M6 | "Every query and database view MUST enforce the 100-mile fence" is too broad: a seller's own listings, admin/moderation, and audit views must not be geo-bounded. Rule now scoped to discovery. |
| M7 | `fairxchange.md` is a research outline critical of ad engines, not an ad-network spec. Fine for now; Phase III needs a principles + requirements doc. |

## Low
- L1 README is a one-line stub.
- L2 `.gitignore` lacked Claude Code local files, Expo native dirs, Supabase CLI state — added.
- L3 Draft README's goal of "full execution autonomy over the stack" conflicts with the governance
  contract (Founder holds release authority). Settings now pre-approve local, reversible commands and
  ask for anything remote or dependency-changing.

## Sources (verified 2026-10-22)
- Claude Code skills, frontmatter, progressive disclosure: https://code.claude.com/docs/en/skills
- Claude Code MCP config, env expansion, project approval: https://code.claude.com/docs/en/mcp
- Claude Code permissions syntax: https://code.claude.com/docs/en/permissions
- Claude Code CLAUDE.md guidance: https://code.claude.com/docs/en/best-practices
- Archived Postgres MCP server: https://startdebugging.net/2026/08/migrate-off-archived-mcp-reference-servers/
- Supabase MCP (hosted URL, `project_ref`, `read_only`, `features`): https://github.com/supabase/mcp
- Prisma lacks PostGIS support: https://www.prisma.io/docs/orm/v7/prisma-client/using-raw-sql/safeql
- Next.js 16.4 (2026-10-06): https://nextjs.org/blog · Expo SDK 56 (2026-05-21, RN 0.85, React 19.2): https://expo.dev/sdk/56
