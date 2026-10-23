# ADR-0008: Platform sequence — desktop web first
**Status:** Accepted (Founder, 2026-10-23)

## Decision
| Phases | Platform |
|---|---|
| I–III (marketplace, creators, ad network) | **Desktop web app** in the browser. Chrome is the reference browser. |
| IV (after the ad network) | **Downloadable desktop app** built on Chromium (the way Postman ships). Electron or Tauri, decided in a future ADR. |
| V (once the model is proven on desktop) | **Native iOS app**, bundle ID `com.hucxter.app` (D-13). |

No native mobile, Expo, or desktop-wrapper work happens before its phase.

## Engineering consequences
- One Next.js app serves the UI, API, and admin console. Expo is removed from ADR-0001.
- `packages/contracts` stays a separate package so Phases IV and V reuse the API contracts.
- Use standard web APIs only, so the Phase IV wrapper can load the same app.
- Sessions are httpOnly cookies, which adds CSRF and CSP requirements (`hucxter-trust-safety`).
- Seller video comes from file upload (drag-and-drop or file picker). Webcam recording in the browser
  is optional, behind a flag.
- Viewer location comes mainly from a saved ZIP/area. Desktop browser geolocation is often based on
  IP or Wi-Fi and can be imprecise.

## Product risks accepted (see roadmap § Executive Board Review)
- Sellers usually film on a phone and then move the file to a computer, which slows listing creation.
- The 21–35 target audience mostly watches short-form video on phones.
- Meetups are arranged on the go, so desktop notifications may be missed.

Phase I measures each of these directly: draft-to-published rate, time to list, time to first
reply, and missed-message rate. D-17 and D-18 are the cheapest ways to reduce them without native
apps.

## Alternatives rejected
Native-first (Founder decision: prove the model on desktop first) and Expo cross-platform
(superseded).
