---
name: hucxter-event-taxonomy
description: Analytics event schema, marketplace liquidity metrics, consent records, category taxonomy, and the typed feed-item envelope that keeps HUCXTER ready for the FairXchange ad network. Use when adding tracking, building the feed API response, touching categories, or anything ads/monetization-adjacent.
---

# Events, feed envelope & ad-readiness

We are not building ads in Phase I. We ARE building the four foundations that make honest,
contextual ads possible later without a rewrite:

## 1. Typed feed envelope (build now)
Every feed/search response returns a list of items with a discriminator:
```ts
type FeedItem =
  | { type: 'listing'; id: string; listing: ListingCard }
  | { type: 'creator_post'; id: string; post: CreatorPostCard }   // Phase II
  | { type: 'sponsored'; id: string; sponsored: SponsoredCard;    // Phase III
      disclosure: 'Sponsored'; why_shown: string };
```
Clients render unknown `type` values as nothing (skip) — never crash. Phase I servers emit only
`listing`. Defined in `packages/contracts/feed.ts`.

## 2. Category taxonomy (build now)
`categories` table: stable ids, parent/child, slug, display name. Listings, searches, and later
ad campaigns all reference these ids. This is what lets "browsing bikes → see a bike-shop ad" work
contextually, without a behavioral profile.

## 3. First-party event log (build now)
Table `events` (append-only) or a vendor SDK behind `track()` — ADR-0006. Rules:
- Event names `object_action` snake_case, versioned schema in `packages/contracts/events.ts`.
- Allowed properties: ids, category_id, distance_bucket, price band, surface, session_id,
  client (`web` in Phase I; later `desktop_app`, `ios`), app build, browser family + major version,
  viewport bucket. **Never**: precise coordinates, phone, message text, raw search text from minors,
  health/religion/etc. sensitive inferences.
- Phase I events: `session_started`, `signup_completed`, `listing_draft_started`,
  `listing_ai_draft_returned`, `listing_published`, `feed_viewed`, `listing_viewed`,
  `listing_saved`, `thread_started`, `message_sent`, `listing_marked_sold`,
  `meetup_confirmed` (self-reported), `report_submitted`, `user_blocked`, `video_upload_started`,
  `video_upload_failed`, `notification_sent`, `notification_opened`, `reply_received`,
  `category_viewed`, `mega_menu_opened`, `hero_clicked`, `location_changed` (ZIP only),
  `filter_applied`, `sign_in_prompted` (with triggering `action`), `sign_in_started` (with
  `method`: email | facebook | tiktok), `phone_verified`, `availability_asked`,
  `listing_status_changed`.
- Desktop-risk metrics (ADR-0008): time from draft started to published, upload failure rate, time
  to first seller reply, share of messages unread after 24 h.
- Every event carries `consent_version`.

## 4. Consent & preferences record (build now)
`user_consents` (user_id, purpose, granted, version, timestamp). Purposes: `analytics`,
`personalization`, later `ads_contextual`. Default for anything ads-related is off until the
privacy policy (counsel) defines it.

## Liquidity metrics (Phase I scorecard — thresholds set by Founder after baseline)
Weekly, per launch area: active listings; % listings with ≥1 thread within 7 days; median time
to first message; thread → self-reported sale rate; repeat sellers; repeat buyers; reports per
100 listings. Compute from `events` + tables; show in admin console.

## FairXchange guardrails (apply to any ads-adjacent code, any phase)
Contextual and in-session intent targeting only; clear "Sponsored" label; "why am I seeing this";
frequency caps; no sensitive-category targeting; no third-party trackers or pixels in the app;
no selling user data; ads never mimic a peer listing without disclosure.
