# ADR-0003: Video pipeline on Mux
**Status:** Proposed · **Date:** 2026-10-22

## Context
Short videos must upload reliably from a desktop browser (files usually filmed on a phone and
transferred) and play fast in a desktop feed.

## Decision
Mux direct uploads from the browser (Mux Uploader / UpChunk, chunked and resumable), signed playback, webhooks drive media state. Playback with Mux Player. No original
downloads exposed (phone-recorded files carry GPS metadata). Encoding tier / resolution cap chosen to minimize cost in
Phase I.

## Alternatives
Cloudflare Stream (similar managed model; compare pricing); R2 + self-managed transcoding (cheapest
storage, but we would own FFmpeg workers, HLS packaging and CDN config — wrong burden for Phase I).

## Verify at implementation
Current Mux pricing, encoding tiers, webhook event names, signing-key flow. Compare against
Cloudflare Stream pricing at expected Phase I volume; record both in this ADR before accepting.
