# Video runbook (Brief 03, Milestone 3C.1)

**Who:** Founder, QA, whoever sets up Mux for the QA environment (3E). **Scope:** listing videos:
direct upload, processing, signed playback, takedown and deletion. Skill:
`.claude/skills/hucxter-video-pipeline`. Never put a Mux key in a file that is committed.

---

## 1. How it fits together

```
browser ──(UpChunk PUT, chunked)──▶ Mux direct-upload URL (storage.googleapis.com)
   │                                         │
   └─ server action createUpload ─▶ Mux API  │  webhooks (signed)
                                             ▼
                          POST /api/webhooks/mux ─▶ media_apply_webhook (idempotent, one txn)
                                                         │ ready → publish if "Publish when ready"
/l/[id] ─▶ media_playback (visibility check) ─▶ signed playback/thumbnail/storyboard tokens
/api/cron/jobs ─▶ jobs queue: delete asset · delete playback id · cancel upload · 24 h orphan sweep
```

- **Provider seam:** `apps/web/src/server/media/provider.ts`. `VIDEO_PROVIDER=mux` uses
  `server/media/mux.ts` (the only module that reads `MUX_*`; enforced by
  `media-secrets.guard.test.ts`). `VIDEO_PROVIDER=fake` is for local and e2e only and is refused
  when `APP_ENV` is `qa` or `production`, or unset with `NODE_ENV=production`.
- **Upload settings:** signed playback only, `video_quality: basic`, `max_resolution_tier: 1080p`,
  `master_access: none`, no static renditions (no original or MP4 downloads; phone videos can
  carry GPS), `cors_origin = APP_ORIGIN`, `passthrough = media id`, upload URL valid for 1 hour.
- **Limits:** `MEDIA_MAX_SECONDS` (default 60) is checked in the browser before upload and again
  on `video.asset.ready`; over-limit media becomes `errored` and its asset is deleted by a job.
  `MEDIA_MAX_BYTES` (default 500 MB) is checked in the browser only: **Mux can't cap a direct
  upload's size** (open risk).
- **Playback tokens** are signed per request for `ready` media the viewer may see. Removed or
  errored media get no token. The player runs with `disableTracking` and `disableCookies` (no Mux
  Data beacons to litix.io).
- **CSP** (`apps/web/src/lib/csp.ts`), only when `VIDEO_PROVIDER=mux`: `connect-src` and
  `media-src` add `https://*.mux.com` (Mux's guidance; several CDN hosts) and
  `storage.googleapis.com` (uploads); `img-src` adds `https://image.mux.com`; `worker-src 'self'
  blob:`. **Decision (Founder, 2026-11-06):** Mux Player's shadow-DOM styles need inline styles, so
  `style-src 'self' 'unsafe-inline'` applies on `/l/*` only. Scripts keep the nonce everywhere.

## 2. Variables (`apps/web/.env.local` locally; the hosting provider's secret store in QA)

| Variable | Notes |
| --- | --- |
| `VIDEO_PROVIDER` | `mux` or `fake`. Default: `fake` when `APP_ENV=local`, otherwise `mux` |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | API access token: **Video** read + write only |
| `MUX_WEBHOOK_SECRET` | From the webhook you create in step 3 |
| `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | A signing key (separate from the API token); the private key as Mux gives it (base64) |
| `MEDIA_MAX_SECONDS`, `MEDIA_MAX_BYTES` | Optional; defaults 60 and 524288000 |
| `CRON_SECRET` | At least 32 random characters. `/api/cron/jobs` compares `Authorization: Bearer …` in constant time |

## 3. Set up Mux for an environment (Founder or 3E)

1. In the Mux dashboard, create (or pick) an **environment per app environment** (local dev,
   QA). Never share one between QA and production.
2. **Settings → Access tokens:** new token with Mux Video read + write (no Data, no System).
   Store the id and secret in the secret store.
3. **Settings → Webhooks:** add `https://<origin>/api/webhooks/mux` for that environment. Copy
   its signing secret into `MUX_WEBHOOK_SECRET`.
4. **Settings → Signing keys:** create a Video signing key. Store the id and private key.
5. Set `CRON_SECRET` and schedule `GET /api/cron/jobs` every 5 minutes with
   `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header). Scheduling is part of 3E.
6. Deploy, then do the manual QA in §5.

Docs checked 2026-11-06: [direct uploads](https://www.mux.com/docs/guides/upload-files-directly) ·
[create direct upload](https://www.mux.com/docs/api-reference/video/direct-uploads/create-direct-upload) ·
[secure playback](https://www.mux.com/docs/guides/secure-video-playback) ·
[webhooks](https://www.mux.com/docs/core/listen-for-webhooks) ·
[verify signatures](https://www.mux.com/docs/core/verify-webhook-signatures) ·
[delete playback ID](https://www.mux.com/docs/api-reference/video/assets/delete-asset-playback-id) ·
[Mux Player React](https://www.mux.com/docs/guides/player-api-reference/react) ·
[CSP](https://www.mux.com/docs/core/content-security-policy) ·
[`@mux/ts` migration](https://github.com/muxinc/mux-ts/blob/main/MIGRATION.md).

## 4. Local development

- **Without Mux (default):** `APP_ENV=local` uses the fake provider. Uploads go to
  `/api/dev/fake-video/upload/[id]`, which posts **signed** webhook events to the real webhook
  route, so the webhook path is the same code that runs in QA. Playback uses a local MP4 fixture
  (`apps/web/e2e/fixtures/fake-video/sample.mp4`, VP9 in MP4 recorded by Playwright's Chromium,
  git-ignored), served as `video/mp4` by `/api/dev/fake-video/file/`, so Mux Player recognises
  the type. Delete an old `sample.webm` there if you have one; it's no longer used.
- **e2e:** `pnpm test:e2e` starts a fourth server on **:3103** (`APP_ENV=local`, production build,
  fake provider). The `hx_fake_video` cookie (`slow` | `error` | `overlong`) drives the processing,
  error and too-long outcomes. With `slow`, the last upload chunk's response carries
  `Hx-Fake-Ready: /api/dev/fake-video/ready/<id>?sig=…`; POST that path (same Origin) to finish
  processing. Without the signature the route answers 403.
- **With real Mux locally:** set `VIDEO_PROVIDER=mux` and the `MUX_*` values for a **dev** Mux
  environment. Mux can't reach localhost, so expose the app with a tunnel (for example
  `cloudflared tunnel --url http://localhost:3000`), set `APP_ORIGIN` to the tunnel URL, and point
  the dev environment's webhook at `https://<tunnel>/api/webhooks/mux`. Run the jobs once with
  `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/jobs`.

## 5. Manual QA (needs real phones and a real Mux environment)

Do each on an **iPhone (Safari)** and an **Android phone (Chrome)**, signed in as a verified QA
member, with the deployed QA build or a tunnel.

1. **Sell → Add a video → Record** (camera capture). Record 10–20 seconds. The upload shows
   progress with Pause/Resume. Turn on airplane mode mid-upload: it says "The upload stopped. Check
   your connection and try again." and choosing the video again works.
2. Fill in the details, then **Publish when ready**. The listing shows "Processing" in My Listings
   and goes **Live** on its own when Mux's `video.asset.ready` arrives (usually under a minute).
3. Open `/l/<id>` as a guest on the other phone: the poster loads, playback starts on tap, and
   only one video plays at a time. Check the browser console has **no CSP violations** with the real
   Mux hosts (Safari: Develop menu with the phone connected; Chrome: `chrome://inspect`).
4. Try a 70-second video: the browser refuses it before upload. (If it gets through, the server
   marks it errored on `ready`.)
5. **Takedown:** as staff, `/admin` → Remove listing. The page returns 404, and after the next
   `/api/cron/jobs` run the old signed playback URL stops working (playback ID deleted).
6. **Account deletion:** delete a test account with a live listing. After the next jobs run, its
   asset is gone from the Mux dashboard.
7. Webhook replay: in the Mux dashboard, resend a delivered `video.asset.ready`. Nothing changes
   (idempotent by event id).

Record the device, OS and browser versions, and results in the PR or the QA tracker.

## 6. Rate limits

Stored in `action_limit_config` (tune with a migration; no code change). Chair defaults, Founder to
tune: listings created 10/day (3/day for accounts younger than 7 days), uploads 10/hour (4/hour),
reports 20/day (5/day). When a limit is reached the UI says "You’ve reached the limit for now. Try
again in about …". Server actions return that state; they don't send HTTP 429.

### Events
Listing events (views, saves, report opens and the rest of `hucxter-event-taxonomy`) go through
`events_insert`, capped per listing per UTC day in `listing_event_counts` (Brief 03C.1b H3):
**200 guest views** and **1,000 events** of all kinds. Over the cap, events are dropped silently;
duplicates (the same viewer and listing on the same day) don't count. Members stay at one view per
member per day. `POST /api/listings/[id]/view` counts only when the browser sends
`Sec-Fetch-Site: same-origin`; scripts can forge that header, so the caps are the real bound. No
IP address is read or stored. Counter rows from before yesterday (UTC) are deleted as new events arrive.

Discover (Brief 03 3D) adds two events through `POST /api/discover/view` (same Origin and
`Sec-Fetch-Site` rules, body at most 256 bytes, no PII):
- `discover_viewed` (no listing): once per viewer per UTC day. Listing-less events are capped at
  **20,000 per event name per UTC day** in `event_day_counts`.
- `discover_item_viewed`: once per viewer per listing per day, after an item has been on screen for
  1 second. Sellers' views of their own items are dropped. Guest item views have their own cap
  (**200 per listing per day**, `guest_discover_views`) so they never use up `listing_viewed`'s
  budget, and both count toward the listing's 1,000.

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| Stuck in Processing | Webhook delivery log in Mux; `mux_webhook_events` has the event id; `MUX_WEBHOOK_SECRET` matches |
| Webhook 400/401 | Signature or clock skew (tolerance 5 minutes); the raw body must not be altered by a proxy |
| Video won't play, console CSP error | `VIDEO_PROVIDER=mux` on that deployment (the CSP adds Mux hosts only then) |
| Poster missing | `/media/poster/<id>` logs `poster_unavailable`; media isn't `ready` or the listing isn't visible |
| Removed video still plays | `/api/cron/jobs` isn't scheduled or `CRON_SECRET` is wrong (401); see `jobs.last_error` |
