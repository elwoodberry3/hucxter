# ADR-0002: Location privacy model
**Status:** Proposed · **Date:** 2026-10-22

## Context
Sellers often list from home. Exact distances let anyone trilaterate a seller's address.

## Decision
Store a private `precise_point` and a public `display_point` snapped to a ~1 km grid. Discovery
filters and distances use `display_point`. Distances shown in buckets. Viewer coordinates rounded
to 2 dp, not stored as history. `precise_point` column-revoked from API roles.

## Alternatives
Random jitter per request (leaks through averaging); exact distance (unsafe); ZIP centroid only
(too coarse in rural areas).

## Consequences
~1 km edge error at the radius boundary; neighbouring listings share a display point (acceptable).
See `.claude/skills/hucxster-geo-radius/`.
