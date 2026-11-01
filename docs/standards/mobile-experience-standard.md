# Mobile Experience Standard

## Hucxter Leadership Directive to Frontend Engineering, UI/UX Design, Product and Quality Assurance

CONTENT  
---

[Executive Mandate	3](#heading=)

[Experience Principles and Decision Hierarchy	4](#heading=)

[Reference Experience Matrix	5](#heading=)

[Required information architecture	6](#heading=)

[Mobile viewport and layout standard	7](#heading=)

[Unified Viewport Architecture	8](#heading=)

[Video discovery and community behavior	9](#heading=)

[Marketplace Catalog and Product Presentation	10](#heading=)

[Design System and Tailwind CSS Rules	11](#heading=)

[Next.js engineering architecture	12](#heading=)

[Motion, gestures and interaction feedback	13](#heading=)

[Performance and Reliability Acceptance Budgets	14](#heading=)

[Accessibility and Inclusion Release Gate	15](#heading=)

[Browser, Device and Network QA Matrix	16](#heading=)

[Security, Privacy and Trust by Design	17](#heading=)

[Required design and engineering deliverables	18](#heading=)

[Milestone Gates	19](#heading=)

[Definition of Done	20](#heading=)

# 

SECTION 1

# Executive Mandate

Hucxter shall deliver an app-quality experience through the mobile browser. A responsive desktop website compressed to phone dimensions is not acceptable. The product combines the transactional clarity of Amazon and eBay, the local and peer-to-peer dynamics of Facebook Marketplace, and the immersive discovery and community behavior of TikTok. These are reference patterns, not instructions to copy proprietary visual designs.

## Product equation

Structured utility \+ dynamic scarcity \+ immersive, discovery-driven video. The experience must support both lean-back entertainment and high-intent purchasing without making users lose their place, context or confidence.

## Leadership's non-negotiable outcome

A person can discover a product in video, inspect its details, evaluate the seller, save or share it, initiate a purchase or bid, and return to the exact point in discovery with minimal friction. Equally, a person arriving with specific purchase intent must be able to search, filter, compare and transact without being forced into video.

# 

SECTION 2

# Experience Principles and Decision Hierarchy

| 1 | Mobile first, not mobile adapted | Design at narrow viewport widths first, then scale upward to tablet and desktop. |
| :---: | :---- | :---- |
| 2 | Content before chrome | Video, listings and community content receive visual priority; navigation and actions remain discoverable. |
| 3 | One continuous journey | Preserve feed position, active item, filter selections and unfinished transaction state across transitions when safe. |
| 4 | Commerce requires clarity | Price, shipping, taxes, seller identity, item condition, bidding rules and total payable must never be hidden behind visual effects. |
| 5 | Fast by design | Favor instant visual acknowledgment, progressive rendering, predictable placeholders and conservative media loading. |
| 6 | Accessible by default. | Every critical action works without gestures, sound or animation; touch, keyboard and assistive technology are first-class. |
| 7 | Trust over engagement tricks | No misleading scarcity, deceptive countdowns, fake inventory signals or ambiguous purchase confirmations. |
| 8 | Browser-native resilience | Back, forward, reload, deep links, safe areas, keyboard opening and interrupted connectivity must behave predictably. |

---

When priorities conflict, choose transaction correctness and user trust first, accessibility second, task completion third, performance fourth, and decorative motion last. Performance and accessibility remain release gates, not optional polish.

# 

SECTION 3

# Reference Experience Matrix

## 

| REFERENCE | PATTERN TO STUDY | HUCXTER INTERPRETATION |
| :---- | :---- | :---- |
| Amazon  | Search, catalog density, product comparison, checkout confidence | Clear intent-based catalog and detailed product data |
| eBay | Listings, item condition, seller reputation, bids and offers  | Transparent peer-to-peer commerce and bidding |
| Facebook Marketplace | Local discovery, seller interaction, proximity relevance | community commerce and location-aware discovery with permission |
| TikTok  | Vertical feed, rapid content exploration, creator engagement  | Immersive video discovery tied to shoppable items |
| Linear | Dense workflows, contextual panels, interaction discipline | Focused, app-like transitions and structured overlays |
| Apple | Fluid typography and restrained motion | Refined responsive visual presentation |
| Nike  | Sticky purchase actions and visual merchandising | Persistent, clear commerce calls to action |
| Stripe | Legible complex information and crisp UI | Trustworthy payment and transaction detail |
| New York Times | Information hierarchy and readable density | Scannable descriptions, reviews and community content |
| Framer | Responsive media and state transitions  | Fluid presentation without excessive runtime overhead |

---

The reference matrix describes design study areas; it is not a verified audit of current implementations on those sites.

# 

SECTION 4

# Required information architecture

The prototype must include coherent navigation and state relationships for Discover, Shop/Search, Create/Sell, Inbox/Activity, and Profile. Labels and ordering require usability validation. Search must be available from shopping contexts and discoverable from the main shell; do not assume that placing every search field at the bottom improves usability.

## Required Core Flows

1. Vdeo → product sheet → item detail → cart/offer/bid → confirmation → resume feed  
2. Search → filters/sort → product detail → transaction  
3. Listing → seller profile → message  
4. Video/listing → save/share → return  
5. Seller → create listing with photos/video, condition, price and fulfillment information. 

Prototype stubs may be used for backend-dependent actions but must be clearly labeled and must not simulate a completed real payment.

# 

SECTION 5

# Mobile viewport and layout standard

| 5.01 | Use \`viewport-fit=cover\` where appropriate and account for \`env(safe-area-inset-\*)\` in bottom navigation, sticky actions and overlays. |
| :---: | :---- |
| 5.02 | Prefer \`100dvh\` or \`100svh\` as appropriate for dynamic browser chrome; do not rely on fixed \`100vh\` for the full-screen video canvas. Test address-bar expansion/collapse and keyboard appearance. |
| 5.03 | Support a minimum reference viewport of 320 CSS px without horizontal scrolling for primary flows; test 360, 375, 390, 414 and 430 CSS px, plus tablet and desktop layouts. |
| 5.04 | Respect user text zoom, font scaling and orientation. Do not disable pinch zoom. |
| 5.05 | Keep critical touch targets at least 44×44 CSS px as the Hucxter design standard, with adequate spacing; provide visible pressed, focused, loading and disabled states. |
| 5.06 | Position primary mobile navigation and high-frequency actions within reasonable thumb reach without obstructing product content or OS gestures. |
| 5.07 | Use responsive containers, content-aware breakpoints and fluid type scales rather than device-model-specific CSS rules. |

# 

SECTION 6

# Unified Viewport Architecture

The source draft's layered experience is adopted as a visual and interaction model, not as a ban on routing.

LAYER A

## Media Canvas

Full-bleed vertical video with poster, captions, playback controls, product association and controlled preloading. Preserve aspect ratio with intentional cropping and text-safe regions.

LAYER B

## Interaction overlay

Like, comment, share, save, seller and product actions. Ensure readable contrast against moving footage using scrims where needed; avoid obscuring captions and key product information.

LAYER C

## Transactional surface

Contextual bottom sheet for quick view, variants, offers, bidding, seller details or cart. Support intermediate and expanded states, explicit close, focus management, scroll containment and escape/back dismissal where appropriate. Complex checkout may use a dedicated routed page when safer or clearer.

LAYER D

## Global shell

Navigation, system messages, permission notices and confirmation feedback. Define semantic elevation tokens; do not hardcode arbitrary z-index values throughout components. Critical dialogs must outrank ordinary navigation, and toasts must not block controls.

## Routing rule

Use Next.js routes and URL state for shareable product, creator, listing and checkout destinations. Use intercepting/parallel routes only where they demonstrably preserve context without breaking direct entry, reload or browser history. Test direct links and back navigation.

# 

SECTION 7

# Video discovery and community behavior

| 7.01 | Support vertical swipe navigation with an equally usable button/keyboard alternative. |
| :---: | :---- |
| 7.02 | Never require autoplay with sound. Follow browser autoplay policies; start muted when autoplay is permitted and offer explicit audio controls. |
| 7.03 | Only the primary visible video may play audio. Pause or suspend off-screen playback; cap simultaneous decoders and prefetch conservatively according to network and device conditions. |
| 7.04 | Preserve playback position where appropriate when opening a product sheet. For deep transaction flows, pause video by default; optional audio ducking must be user-tested, accessible and consistent with audio preferences. |
| 7.05 | Show captions/subtitles for speech-bearing video and provide clear audio-state indicators. |
| 7.06 | Implement explicit empty, error, retry, blocked-autoplay and poor-network states. |
| 7.07 | Comments, follows, saves and shares require optimistic feedback only when reversibility and server reconciliation are handled; never imply a server write succeeded when it did not. |
| 7.08 | Provide reporting, blocking and moderation entry points in the community UI even if prototype operations are mocked. |

SECTION 8

# Marketplace Catalog and Product Presentation

## Catalog

Offer a stable, scannable default grid. Test asymmetric/masonry layouts as a controlled enhancement for media-rich discovery; do not sacrifice scanability, reading order, scroll stability or accessibility merely to create visual energy. Use consistent card metadata: image, title, price, condition, location/shipping indicator and seller trust cues where available.

## Media

Use optimized responsive images with explicit dimensions/aspect ratios and appropriate formats. Animated previews or muted micro-videos must be optional, resource-budgeted, and triggered only when visibility and user settings permit. Avoid automatic motion in dense result grids when it harms performance or comprehension.

## Product detail

Show image/video gallery, title, price, condition, seller, availability, shipping/pickup, return terms, reviews where genuine, and a clear primary action. Distinguish Buy Now, Make Offer, Place Bid, and Message Seller; never collapse different financial commitments into one ambiguous control.

# 

SECTION 9

# Design System and Tailwind CSS Rules

Create a token-driven design system covering color roles, type scale, spacing, radii, shadows/elevation, motion, responsive containers, touch targets, focus states and semantic status colors. Tokens must support light/dark surfaces where the product design calls for them and maintain contrast over video.

Build reusable primitives for \`AppShell\`, \`BottomNavigation\`, \`VideoFeed\`, \`VideoCard\`, \`VideoActions\`, \`ProductCard\`, \`ProductGrid\`, \`ProductDetail\`, \`BottomSheet\`, \`SellerBadge\`, \`SearchBar\`, \`FilterDrawer\`, \`BidPanel\`, \`CartSummary\`, \`Toast\`, \`Skeleton\`, \`EmptyState\`, and \`ErrorState\`. Names are illustrative; final component APIs belong to engineering.

Use Tailwind utilities for composition, CSS custom properties for shared tokens, and component variants for repeatable states. Avoid uncontrolled one-off arbitrary values and copy-pasted interaction logic. Document component anatomy, responsive variants, keyboard behavior and empty/loading/error states in the design handoff.

# 

SECTION 10

# Next.js engineering architecture

| 10.01 | Use Next.js App Router with TypeScript strict mode and clearly separated server and client responsibilities. |
| :---: | :---- |
| 10.02 | Default to Server Components for noninteractive product/catalog content; isolate client components for media, gestures, sheets and local interaction state. |
| 10.03 | Use server-rendered initial content where feasible, streaming and Suspense for progressive sections, and targeted cache/revalidation policies appropriate to freshness requirements. |
| 10.04 | Do not cache volatile inventory, bids or payment status as if they were static truth. Revalidate server-authoritative data before committing financial actions. |
| 10.05 | Use semantic HTML, real links for navigation and real buttons for actions. Provide metadata and canonical/shareable product URLs where applicable. |
| 10.06 | Keep critical navigation usable before heavy media and secondary scripts load. |
| 10.07 | Virtualize long lists only when necessary, with stable keys, focus preservation and predictable restoration; avoid introducing scroll jumps. |
| 10.08 | Use \`next/image\` or an equivalent optimized media pipeline for still assets; video delivery needs separate poster, encoding, buffering and adaptive-streaming decisions. |
| 10.09 | Guard client/server boundaries; avoid hydration mismatch, excessive global state and unnecessary rerenders during scroll or playback. |

# 

SECTION 11

# Motion, gestures and interaction feedback

| 11.01 | Target smooth 60 fps on supported midrange devices for primary interactions, while accepting hardware-dependent limits and monitoring dropped frames. |
| :---: | :---- |
| 11.02 | Prefer transform and opacity for short animations, but do not assume \`translate3d()\` or permanent \`will-change\` automatically improves performance. Profile actual layer and memory cost; remove hints when not needed. |
| 11.03 | Respect \`prefers-reduced-motion\`, offer nonanimated alternatives and avoid scroll-jacking. |
| 11.04 | Bottom sheets must not compete with page scroll, video swipes or browser navigation gestures. Define gesture thresholds, cancel behavior and conflict rules. |
| 11.05 | Every actionable control must acknowledge input immediately, then communicate progress and final outcome honestly. A skeleton is appropriate when layout is known; use a spinner or explicit status for discrete long-running actions where a skeleton would mislead. |

SECTION 12

# Performance and Reliability Acceptance Budgets

These are leadership targets for the prototype, to be measured on representative real devices and realistic mobile networks, not guaranteed properties of any framework.

| METRIC | REQUIRED TARGET | MEASUREMENT |
| :---- | :---- | :---- |
| Largest Contentful Paint (LCP)  | ≤ 2.5 s at p75 | Field/RUM where available; representative lab scenarios |
| Interaction to Next Paint (INP) | ≤ 200 ms at p75 | Field/RUM where available; instrument interactions in lab |
| Cumulative Layout Shift (CLS) | ≤ 0.10 at p75  | Field and lab |
| Input acknowledgment  | Immediate visible feedback, ideally within 100 ms | Interaction traces |
| Primary transitions  | No perceptible jank under representative load | Device profiling and video capture |
| Primary mobile layout  | No unintended horizontal overflow at 320 CSS px | Automated viewport tests |
| Media lifecycle | No competing offscreen video audio; controlled preloading | Device/network instrumentation |
| Navigation resilience | Back/forward, reload, deep link and restored state pass | E2E test suite |

---

Set route-level JavaScript, image and video transfer budgets after measuring the baseline prototype. Do not invent a universal byte threshold before representative media encoding and device testing. Track bundle regressions and resource consumption on every release candidate.

# 

SECTION 13

# Accessibility and Inclusion Release Gate

Target WCAG 2.2 AA for supported user journeys. Provide semantic landmarks, logical headings, labeled controls, keyboard access, visible focus, sufficient contrast, accessible error messaging, screen-reader announcements for meaningful state changes, and predictable focus return after dialogs close. Support reduced motion, captions, zoom and non-gesture alternatives. Validate sheet focus traps, inert backgrounds, product card reading order and dynamic feed announcements. Automated scanners are necessary but insufficient: perform manual screen-reader and keyboard checks.

# 

SECTION 14

# Browser, Device and Network QA Matrix

Test current stable iOS Safari and Android Chrome on physical devices, plus desktop Chrome, Safari, Firefox and Edge for responsive behavior. Include at least one midrange Android device and one older supported iPhone. Test portrait and landscape, light/dark settings, low power, slow/intermittent networks, interrupted uploads, expired sessions, back/forward cache behavior, on-screen keyboards, permission denial and no-audio contexts. Record supported OS/browser minimums explicitly after product and audience review.

Automate critical paths with Playwright or equivalent; use Lighthouse and browser performance traces for diagnostics; verify on physical devices because emulators cannot reproduce all browser chrome, decoding, touch and memory behavior.

# 

SECTION 15

# Security, Privacy and Trust by Design

Use secure authentication/session handling, server-side authorization and input validation. Never trust client price, inventory, bid or transaction state. Protect personal messages and precise location; ask for location permission only in context and provide a manual alternative. Prevent unsafe user-generated HTML, validate uploads, and implement reporting/blocking flows. Use a compliant payment provider and do not store raw payment-card details in the frontend. Mark paid placements and sponsored content clearly when introduced.

# 

SECTION 16

# Required design and engineering deliverables

## Design

Mobile-first flows and high-fidelity responsive screens; component library; interaction/gesture specifications; safe-area rules; accessibility annotations; loading, empty, error and offline states.

## Engineering

Next.js application shell; reusable Tailwind token system; routable product/listing pages; video feed; commerce sheets; search/catalog; state restoration; media controls; instrumentation.

## QA

Device/browser coverage report; accessibility findings; Core Web Vitals and interaction traces; route/deep-link tests; checkout/bid failure-state tests; known limitations and severity.

## Product

Clear prototype-versus-production capability labels; authoritative sample data; defined demo scenarios and acceptance owners.

# 

SECTION 17

# Milestone Gates

GATE 1

## Architecture and Design Approval

Sign off on navigation map, mobile shell, token system, routing model, media strategy and measurable budgets.

---

GATE 2

## Experience vertical slice

Demonstrate video → product sheet → detail/transaction intent → return to preserved video position, including back navigation, keyboard access and failure states.

---

GATE 3

## Marketplace parity

Demonstrate intent-based search, filters, listings, seller context, save/share, cart or offer/bid semantics and mobile responsive behavior.

---

GATE 4

## Release candidate

Pass device matrix, accessibility checks, performance budgets, privacy/security review and documented regression suite. No P0/P1 defects remain open; leadership signs off on any lesser exceptions.

# 

SECTION 18

# Definition of Done

A feature is complete only when its visual states, touch/keyboard/screen-reader interactions, direct-link behavior, mobile layout, error recovery, instrumentation and automated tests are delivered. A successful desktop demo is not evidence of mobile readiness. A polished video animation is not evidence of a trustworthy marketplace transaction.

## Final Leadership Expectation

Hucxter must feel effortless as a social feed, precise as a retail catalog, and trustworthy as a transaction platform—within the constraints and strengths of the modern mobile browser. The quality bar is not merely responsive design. It is a coherent, resilient, accessible and measurable mobile product experience.

