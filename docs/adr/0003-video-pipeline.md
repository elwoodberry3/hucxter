# ADR-0003: Video pipeline on Mux
**Status:** Proposed · **Date:** 2026-10-22

## Context
Short vertical videos must upload reliably from phones and play fast in a feed.

## Decision
Mux direct uploads (client → Mux), signed playback, webhooks drive media state. No original
downloads exposed (phone GPS metadata). Encoding tier / resolution cap chosen to minimize cost in
Phase I.

## Alternatives
Cloudflare Stream (similar managed model; compare pricing); R2 + self-managed transcoding (cheapest
storage, but we would own FFmpeg workers, HLS packaging and CDN config — wrong burden for Phase I).

## Verify at implementation
Current Mux pricing, encoding tiers, webhook event names, signing-key flow. Compare against
Cloudflare Stream pricing at expected Phase I volume; record both in this ADR before accepting.
