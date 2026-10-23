# Hx brand assets

| File | Use |
|---|---|
| `hx-icon-master-1080.png` | Master Hx app icon (D-15). Full-bleed 1080 × 1080, RGB, no transparency, square corners. Source for every other size. |
| `web/favicon.ico` | Browser tab icon (16, 32, 48 px) |
| `web/favicon-16.png`, `web/favicon-32.png`, `web/favicon-48.png` | PNG favicons |
| `web/apple-touch-icon.png` | 180 px, used for Safari bookmarks and home-screen shortcuts |
| `web/icon-192.png`, `web/icon-512.png` | Web app manifest icons |
| `web/icon-maskable-512.png` | Manifest icon with `"purpose": "maskable"`. The mark stays within the central 80% safe zone (it reaches 24% of the width from center). |

- Background `#545072`, mark `#FFFFFF`.
- Generated 2026-10-23 from the master by downscaling with Lanczos. Regenerate whenever the master changes; never edit the derived sizes by hand.
- `../app-icon.png` is the older pre-rounded preview with transparent corners. It's for decks and documents only, never for product icons.
- Future needs: a vector (SVG) master for crisp favicons and for the desktop app (Phase IV), plus iOS icon sets when native work begins (Phase V, bundle ID `com.hucxter.app`).
