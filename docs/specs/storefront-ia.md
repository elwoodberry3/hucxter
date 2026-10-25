# Storefront Spec v1: header, categories, home, category index, product page, footer, gating

**Status:** Approved direction (ADR-0009, Founder grooming 2026-10-24). Visual references:
`brief-1__ui.0002` (header + mega menu); Amazon, eBay, Apple, and Facebook Marketplace signed-out
layouts for structure only. Design rules: `hucxter-design-system` (Apple HIG baseline, desktop web).

## 1. Global header (all pages, sticky)
```
[Hx Hucxter]  [📍 Near Aubrey 75009 ▾]  [ 🔍 Search Hucxter ................ ]  [+ Sell] [💬] [Sign in | (avatar ▾)]
[≡ All Categories ▾]  Electronics  Home & Living  Fashion  Sports & Outdoors  Tools  Baby & Kids  Free Stuff  More ▾
```
- **Logo** links to `/` (the Feed). There is no separate Home or Feed nav item.
- **Location chip:**
  - Shows the area label and ZIP, and opens a popover: enter a ZIP, "Use my current location"
    (browser geolocation, user-initiated), and a radius select.
  - For guests, the default comes from **approximate IP location**, shown as "Near Aubrey 75009?"
    so it's clearly a guess, and editable.
  - Stored only in a first-party cookie (ZIP + radius). Never sent to analytics with more
    precision than the ZIP.
  - In local dev, falls back to `DEFAULT_AREA_ZIP`.
- **Search:**
  - Placeholder "Search Hucxter". Never claim inventory size ("millions of items").
  - Submits to `/search?q=…` with the current location.
  - Optional category scope dropdown *(proposed)*.
- **+ Sell:**
  - Primary button.
  - Guests go to sign-in with `next=/sell`.
- **Messages:**
  - Icon button with an unread badge (members only).
  - Guests go to sign-in.
- **Account control:**
  - Guest: **Sign in** button. Its menu offers "Sign in" and "Create account".
  - Member: avatar menu with My Listings · Saved · Messages · Profile · Settings · Help ·
    Sign out, plus Admin for moderators and admins.
- **Category bar:**
  - "All Categories" opens the mega menu (§2).
  - Top-level departments per the taxonomy order, then "More ▾".
  - Active department is underlined, with `aria-current`.

## 2. Mega menu (reference `brief-1__ui.0002`)
- Left column: all 14 departments; hover or arrow-key focus switches the right panel.
- Right panel: the department name, then subcategory groups in 2–3 columns.
- Keyboard: Esc closes, ↑/↓ move through departments, → enters the panel, focus is trapped while
  open, and focus returns to the trigger.
- Opens on click. Hover opens after a short delay; there's no hover-only behavior.

## 3. Home / Feed (`/`): the store must never look empty
In order from top:
1. **Hero carousel** (max 3 slides, auto-advance off by default, pause control, respects
   reduced motion). Phase I slides are house content: a seasonal hero ("Holiday finds near you"),
   "Sell it in seconds: film it, post it, meet up," and "Meet safely: public exchange spots."
   Each links to a real page; a category page with an empty state is acceptable.
2. **Shop by category:** a card grid of all departments (art + name), linking to `/c/[slug]`.
3. **Near you rails:** "New near Aubrey," "Free stuff near you," and one rail per featured
   department.
   - With listings: horizontal listing cards.
   - Without listings: the rail shows a **designed invitation card** instead ("Be the first to list
     furniture near Aubrey → Sell"). No fake listings.
4. **Promo strip** with house promos: safety tips, invite friends *(future)*, "How Hucxter works."
5. **Sponsored slot placeholder** *(proposed)*: one in-feed slot rendered through the typed feed
   envelope (`type: 'sponsored'`). In Phase I it shows a house promo **labeled "Promoted by
   Hucxter"**, never a fake third-party ad. This reserves layout space for FairXchange (Phase III).

## 4. Category index (`/c/[dept]`, `/c/[dept]/[sub]`)
- **Subcategory row** under the category bar (chips) with the active one selected.
- **Breadcrumb:** Feed › Department › Subcategory.
- **Hero banner** per department (placeholder art, `hero_key`).
- **Left filter panel** (240–280 px):
  - Common filters, then the department's attribute filters (taxonomy spec).
  - Filters live in the URL query string, so pages are shareable and back/forward work.
  - "Clear all."
- **Results:** toolbar (result count, sort select), then a responsive grid of **listing cards**:
  - 9:16 video poster
  - price
  - title
  - condition
  - distance bucket
  - area
  - status badge if Pending
- **Empty state:** illustration + "Nothing in Bikes near Aubrey yet" + [Sell a bike] + [Widen your
  radius] + [Browse all categories].
- Pagination uses keyset pagination with a "Load more" button.

## 5. Product page (`/l/[listingId]`)
**Two columns:**
- **Left: vertical video player**, 9:16, muted autoplay. The poster frame plus thumbnails of
  additional clips are Phase II.
- **Right: detail column.**
  - Title; **price** (or **Free**); status badge.
  - Condition · distance bucket · area label · posted time.
  - **Primary action: "Is this still available?"**
    - One tap sends that message in a new thread tied to this listing, then opens the thread.
    - If the member already has a thread, the button changes to "Open conversation."
  - **Secondary actions:** Save · Share · Report.
  - Attribute table (from the category schema).
  - Description; for AI-drafted text, the seller has confirmed it. No "AI" label is shown to
    buyers once the seller has edited and published.
  - **Seller card:** display name, member since, verified badges (phone ✓, email ✓), response
    time *(later)*. Ratings and reviews come later.
  - **Meet safely panel:** suggested public exchange spots near the area; never addresses.
  - "More from this seller" and "Similar near you" rails (empty states allowed).

**Status model (ADR-0009):**

| Status | Who sets it | Buyer sees | Can buyers message? |
|---|---|---|---|
| Available | default | — | Yes |
| Pending | seller ("Someone's on the way") | "Pending: someone's on the way" | Yes ("Let me know if it falls through") |
| Sold | seller | "Sold", item hidden from feeds after N days | No new threads |

- Pending → Available: the seller taps "They didn't show." After a configurable time (D-27) the app
  prompts the seller to confirm Sold or Available. It never auto-flips silently.
- Every status change is time-stamped. Changes are visible to the seller; buyers see the current
  status only.

**Guest view:**
- Guests see the full page.
- Every action opens a **sign-in sheet**: "Sign in to message this seller." The sheet offers
  Continue with email · Continue with Facebook · Continue with TikTok, plus "New here? Create an
  account."
- The sheet returns guests to the same listing and completes the intended action after sign-in,
  once verification is done.

## 6. Footer (all pages)
Four columns plus a bottom row:
- **Shop:** all departments.
- **Sell:** How selling works · Sell an item · Seller safety.
- **Safety & Help:** Meetup tips · Report a problem · Help center · Contact.
- **Company:** About · Careers *(later)* · Press *(later)*.

Bottom row: © Hucxter · Terms · Privacy · Prohibited items · Location: Near Aubrey 75009.
Links for pages that don't exist yet go to a simple "Coming soon" page with the footer intact. No
dead 404s.

## 7. Routes after Brief 02
| Route | Guest | Member |
|---|---|---|
| `/` | ✓ | ✓ |
| `/c/[dept]`, `/c/[dept]/[sub]` | ✓ | ✓ |
| `/search` | ✓ | ✓ |
| `/l/[id]` | ✓ (actions gated) | ✓ |
| `/sign-in`, `/sign-up` | ✓ (UI only until Brief 03) | redirect to `/` |
| `/sell`, `/messages`, `/saved`, `/listings`, `/profile`, `/settings` | redirect to `/sign-in?next=…` | ✓ (placeholder content until their briefs) |
| `/admin` | 404 | role-gated (Brief 03) |
| `/dev/templates/listing` | **local/QA only**: renders the product template with a labeled demo fixture; returns 404 when `APP_ENV=production` | same |

## 8. Analytics events added (event-taxonomy skill)
`category_viewed`, `mega_menu_opened`, `hero_clicked`, `location_changed` (ZIP-level only),
`filter_applied`, `sign_in_prompted` (with the `action` that triggered it), `sign_in_started`
(with `method`), `availability_asked`, `listing_status_changed`.
