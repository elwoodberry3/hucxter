# ADR-0006: Analytics events
**Status:** Proposed · **Date:** 2026-10-22

## Decision (recommended)
First-party `events` table in Postgres behind a `track()` helper with schema-validated payloads
(`packages/contracts/events.ts`). Liquidity scorecard computed in SQL for the admin console.

## Alternatives
PostHog (product analytics + experiments + feature flags; can self-host or cloud) — strong option
for Phase II experiments. If chosen, keep the same `track()` contract so the vendor is swappable,
and disable autocapture of text inputs.

## Constraints
No precise coordinates, phone numbers, or message text in events. Every event carries
`consent_version`. No third-party ad pixels in any phase.
