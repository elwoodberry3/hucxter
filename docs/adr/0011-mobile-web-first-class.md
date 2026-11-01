# ADR-0011: Mobile web is a first-class Phase I surface
**Status:** Accepted (Founder, D-37, 2026-10-31) · **Amends:** ADR-0007 (layout), ADR-0008
(platform sequence), ADR-0009 (storefront IA)

## Context
ADR-0008 made Phase I desktop web only, and ADR-0009 showed a "works best on a desktop browser"
notice below 1280×720. The biggest risk ADR-0008 accepted is that sellers film on their phones and
then have to move the file to a computer. The QA release (Brief 03) needs testers on real phones.
The Founder adopted the Mobile Experience Standard
(`docs/standards/mobile-experience-standard.md`) on 2026-10-31.

## Decision
The Hucxter web app is built **mobile first** and works as a first-class experience in phone
browsers (iOS Safari, Android Chrome) as well as desktop browsers. One Next.js app serves both, with
content-based breakpoints. There is still no native app, Expo app, or desktop wrapper in Phase I.

The standard is adopted **except** where it conflicts with the zero-shipping, no-payments Phase I
product. These rules win over the standard's text:
- **No** cart, Buy Now, bids, offers, shipping, taxes, returns, checkout, or payments (D-09). The
  standard's "transaction" step means: see price, condition, status, pickup area and seller, then
  **"Is this still available?"**, plus Save, Share and Report.
- "Dynamic scarcity" means **real** listing status only (Available / Pending: someone's on the way /
  Sold). No countdowns, "X people viewing", or invented urgency.
- "Reviews where genuine": none exist, so none are shown.
- Styling stays **CSS Modules + CSS custom-property tokens** (D-38). The intent of the standard's §9
  (tokens, variants, no one-off values, documented states) is met without Tailwind.
- The **bottom tab bar** is a phone-width pattern. Desktop widths keep the ADR-0009 storefront
  header.
- Apple HIG stays the baseline (ADR-0007): iOS patterns at phone widths (tab bar, sheets, 44 pt
  targets) and macOS patterns at desktop widths.

## What changes
- **Phone widths:** compact sticky header (Hx mark, location chip, search button → full-screen
  search), scrollable category chips with an "All categories" sheet, bottom tab bar (Home ·
  Discover · Sell · Inbox · Account), filters in a bottom-sheet drawer, footer accordions, and a
  sticky action bar on product pages.
- **Desktop widths:** ADR-0009 unchanged, plus a Discover link in the header.
- The "best on a desktop browser" notice is removed. Primary flows work from 320 CSS px with no
  horizontal scrolling. Touch targets are at least 44×44 CSS px. Safe-area insets are respected.
  Pinch zoom is never disabled.
- Playwright runs desktop Chromium plus mobile Chromium (Pixel 7) and mobile WebKit (iPhone 15).

## Consequences
- **D-17 (phone-to-desktop upload handoff)** is largely solved: a phone browser can record and
  upload directly with `<input type="file" accept="video/*" capture>`. A QR handoff is only needed
  if desktop-only sellers ask for it.
- **D-18 (notifications outside the open tab)** still needs a decision. Mobile web push has
  platform limits (iOS requires a home-screen web app).
- The Phase IV (Chromium desktop app) → Phase V (native iOS) order is unchanged.
- Every UI change now needs evidence at desktop **and** phone widths (screenshots, axe, e2e).

## Alternatives considered
- **Stay desktop-only for Phase I:** keeps the file-transfer friction for sellers and leaves QA
  testers off their phones.
- **Native or Expo app now:** rejected by ADR-0008; mobile web gets most of the value without a
  second codebase.
