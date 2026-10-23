---
name: hucxster-video-pipeline
description: Short-form listing video capture, upload, transcoding, playback, and lifecycle for HUCXSTER using Mux. Use when touching video upload, webhooks, media states, players, thumbnails, or media deletion.
---

# Video pipeline (Mux, ADR-0003 — Proposed)

## Flow
1. Mobile client asks `POST /api/media/uploads` (authenticated) for an upload slot.
2. API creates a `listing_media` row (`status='awaiting_upload'`, `owner_id`) and a Mux **direct
   upload** with `playback_policy: signed`, CORS origin restricted, and `passthrough` = media row id.
   Returns only the one-time upload URL + media id.
3. Client uploads the file straight to Mux (never through our API). Show progress; allow retry.
4. Mux webhooks hit `POST /api/webhooks/mux`. Verify the signature header with the webhook secret
   BEFORE parsing. Handle idempotently (store processed event ids). Map events to states:
   `awaiting_upload → processing → ready | errored`. Unknown events: log and 200.
5. Playback: API returns a short-lived signed playback token for `ready` media the viewer is allowed
   to see. Never expose asset ids or master/original files to clients.

Verify current Mux API fields and webhook event names against Mux docs at implementation time;
do not rely on memory. Record what you verified in the PR description.

## Constraints
- Max duration and file size are config values (`MEDIA_MAX_SECONDS`, `MEDIA_MAX_BYTES`), set by the
  Founder; enforce client-side for UX and server-side on the `ready` webhook (reject + delete if over).
- **Strip location metadata risk**: phone videos carry GPS metadata. Do not enable master access or
  original downloads; serve only transcoded renditions. Never read metadata into our DB.
- Thumbnails come from Mux image URLs (signed). Poster frame chosen by seller; default 1s.
- Captions/frames passed to AI go through `hucxster-valuation-agent` rules (untrusted input).
- Feed autoplay: muted by default, respects Reduce Motion and Low Data Mode; preload only the
  next item. Measure startup time and rebuffering before setting budgets (no invented targets).

## Lifecycle
- Deleting a listing soft-deletes media immediately (hidden) and enqueues a job to delete the Mux
  asset; job is idempotent and retried.
- Orphans: a daily job deletes `awaiting_upload` rows older than 24 h and their Mux uploads.
- Moderation takedown sets `status='removed'` and revokes playback; asset retained per the
  retention policy (Founder + counsel decision, see open decisions).

## Cost hygiene
Track minutes encoded, stored, and delivered per week in the admin console from Mux usage data.
Phase I encoding tier and resolution cap are ADR-0003 decisions — do not raise them in code.

## Tests
Webhook signature rejection; idempotent replay of the same event; state machine illegal
transitions rejected; non-owner cannot attach media to a listing; playback token denied for
`removed`/`errored` media.
