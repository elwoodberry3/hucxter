# ADR-0004: Background jobs on Postgres
**Status:** Proposed · **Date:** 2026-10-22

## Decision
A Postgres-backed queue (Supabase Queues/pgmq or pg-boss — pick one at implementation after
checking current support) for: AI draft generation, Mux asset deletion, orphan cleanup, metric
rollups. Jobs are idempotent with retry + dead-letter. Rate limits use Postgres counters.

## Alternatives
Redis/Upstash + BullMQ (extra service, not needed at Phase I volume); Inngest/Trigger.dev (good DX,
another vendor). Revisit when queue latency or DB load is measured as a problem.
