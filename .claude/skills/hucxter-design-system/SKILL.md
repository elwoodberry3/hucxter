---
name: hucxter-design-system
description: Hucxter desktop-web UI rules built on Apple's Human Interface Guidelines — layout, navigation, keyboard, typography, color tokens, icons, video feed, accessibility, and the Hx brand. Use before building or changing any page, component, or style in apps/web.
---

# Hucxter design system (ADR-0007 + ADR-0008)

Apple's Human Interface Guidelines (HIG) are the structural baseline for every Hucxter surface.
Phases I–III are a **desktop web app in Chrome**, so apply the HIG's macOS patterns rendered as web
UI, on both Mac and Windows. Where the HIG and web accessibility standards differ, meet both
(WCAG 2.2 AA is the floor). Check the current HIG at
developer.apple.com/design/human-interface-guidelines when unsure; don't rely on memory.

## Layout & navigation
- **App shell** (mockups 1, 8, 9, 10): persistent left **sidebar** (Feed, Search, Sell, Messages,
  Saved, My Listings, Profile; the Admin link only for moderators/admins) plus a top **toolbar**
  (search field, Sell button, messages, notifications, account menu). The sidebar collapses to
  icons below 1440 px wide.
- **Viewport:** design at 1440×900, support down to 1280×720. Below that, show a "Hucxter works
  best on a desktop browser" notice. No mobile layouts in Phase I.
- **Feed** (mockup 9 pattern): a centered vertical video column (9:16) next to a detail panel
  showing title, price, condition, distance bucket, area label, seller, and actions (Message, Save,
  Share, Report). One item in focus at a time.
- **Containers:** sheets/modals for short tasks (report, meetup spot, filters); popovers for menus
  (mockup 6); a full page for the Sell flow. Every modal can be closed with Esc and returns focus to
  the element that opened it.
- **URLs:** every listing, profile, and thread has a shareable URL; browser back/forward always work.
- Out of Phase I scope, though they appear in mockups: cart/"Add to Bag", orders, official stores,
  star ratings, Creator Studio, menu-bar app, launcher/setup wizard (Phase IV desktop app).

## Keyboard (first-class on desktop)
- Everything works without a mouse, with a visible focus ring (`:focus-visible`, at least 3:1
  contrast).
- Feed shortcuts: ↑/↓ or J/K for next/previous item, Space to play/pause, M to mute, S to save,
  Enter to open the listing. `?` shows the shortcut sheet. Shortcuts are disabled while typing in
  inputs.
- Logical tab order; skip-to-content link; arrow keys inside menus and lists.

## Typography
- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, which gives SF on Macs and
  Segoe UI on Windows. Don't self-host or bundle Apple fonts.
- Use a type scale that follows the HIG roles (Large Title, Title 1–3, Headline, Body, Callout,
  Subheadline, Footnote, Caption). Set sizes in `rem` so browser zoom and text size work; layouts
  must still work at 200% zoom. Body at least 15 px; nothing below 11 px.

## Color (provisional tokens — tune in code, keep the names)
Use CSS custom properties with light and dark values, following `prefers-color-scheme` plus a user
override. Components use tokens only, never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--hx-brand` | `#545072` | `#545072` | Hx mark background, brand surfaces |
| `--hx-accent` | `#6457AF` | `#AA9CEC` | Primary buttons, selected nav, links |
| `--hx-accent-subtle` | `#EEEAFB` | `#2B2745` | Selected chips, soft fills |
| `--hx-bg` / `--hx-bg-elevated` | `#F5F4F2` / `#FFFFFF` | `#16151C` / `#211F2A` | Window / cards |
| `--hx-label` / `-secondary` / `-tertiary` | `#1C1B22` / 60% / 35% | `#F4F3F8` / 65% / 40% | Text |
| `--hx-separator` | `rgba(0,0,0,.1)` | `rgba(255,255,255,.12)` | Hairlines |
| `--hx-destructive` / `--hx-success` | `#C8372C` / `#257A4A` | `#FF6B5E` / `#4CC38A` | Remove/block · sold/confirm |
| `--hx-on-accent` | `#FFFFFF` | `#16151C` | Text/icons on accent buttons |

Text must meet WCAG AA contrast (4.5:1 body, 3:1 large) in both modes. Checked 2026-10-23: accent,
labels, destructive, and success pass 4.5:1 on their backgrounds; `--hx-label-tertiary` (about
2.2:1 light, 3.5:1 dark) is for placeholders and disabled states only, never for readable text. In
dark mode, accent buttons use dark text (`--hx-on-accent`), because white on `#AA9CEC` fails.
Re-check whenever a token changes.

## Icons
Use one cross-platform, permissively licensed icon set (Lucide is the default; confirm the license
in the PR) at 16/20/24 px. Don't use SF Symbols on the web; Apple's license is understood to
restrict them to Apple platforms.

## Spacing, shape, depth
8 px grid (4 px for tight internals). Radius: 12 px cards, 8 px buttons and inputs. Show depth with
subtle shadows and translucency (backdrop blur on the toolbar only). No heavy borders, neon, or hard
offset shadows.

## Pointer & interaction
- Pointer targets at least 24×24 CSS px (WCAG 2.2 SC 2.5.8). Primary buttons 32–40 px tall.
- Hover states on every interactive element; never put information *only* in hover.
- Destructive actions confirm with a specific title ("Remove listing?") and a destructive button.
- Drag-and-drop upload zone for video, with a file-picker fallback.

## Video in the browser
- Mux Player for playback. The feed autoplays **muted** (Chrome blocks autoplay with sound) and only
  the focused item plays. Preload the next item only.
- Respect `prefers-reduced-motion` (no autoplay; show a poster and a play button) and
  `prefers-reduced-transparency`.
- Captions and overlays never carry information that only the audio carries.

## Accessibility (non-negotiable)
Semantic HTML first, ARIA only when needed. Every control has an accessible name. Video items
announce title, price, distance bucket, and area. Test with VoiceOver (Mac) or NVDA (Windows) and an
automated axe check in Playwright.

## Voice
Plain, direct, friendly, local. Short labels ("Message seller", "Mark as sold"). Safety copy is calm
and specific. AI text is labeled "AI draft — check before posting."

## Brand assets
`assets/images/brand/`: use `web/favicon.ico`, the PNG favicons, `apple-touch-icon.png`, and the
`icon-192/512` + maskable manifest icons. Copy them into `apps/web/public/` and reference them from
the Next.js metadata and manifest. Never use `assets/images/app-icon.png` (pre-rounded preview).

## Verification for UI changes
Playwright screenshots in desktop Chrome at 1440×900 and 1280×800, light and dark mode, plus one at
200% zoom; keyboard-only walkthrough of the changed flow; axe report with no serious or critical
violations. Attach all of it to the PR.
