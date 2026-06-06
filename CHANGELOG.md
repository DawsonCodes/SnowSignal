# Changelog

All notable changes to SnowSignal are documented here. This project is in **public
beta**; versions follow [semantic versioning](https://semver.org) with pre-release tags.

## [1.0.0-beta.3] — 2026-06-06

Another focused **polish beta** — not a stable release. The transparent deterministic
engine is preserved (with one narrow safety improvement noted below); no backend, no
framework, no new build step, no analytics or tracking. The GitHub Pages URL stays on
the `/snowsignal/` subpath, and beta.2 preferences, saved/recent locations, and share
links keep working.

### Added
- **Winter-weather plausibility gate** — a small, isolated `hasMeaningfulWinterHazard()`
  helper. When there is no meaningful winter hazard in the forecast window (snow, ice,
  near-freezing precipitation, an official winter alert, lingering cold snowpack, or
  dangerous wind chill), closure and delay estimates resolve to **0%** with a clear
  explanation. District sensitivity, warm-weather wind, and the calendar month can no
  longer manufacture a phantom snow-day chance — and a genuinely unusual out-of-season
  snow/ice event is **not** blocked by the month.
- **Accent-hue customization** (Appearance → Accent hue): a constrained hue slider with
  locked saturation/lightness, applied to the accent, borders, and ambient glow via CSS
  custom properties. Includes **Reset accent**. Warning/error/status colors stay distinct.
- **Schedule context panel** — heuristic weekend / summer-break / winter-break reminders
  now live in their own compact, expandable card, hidden until a location/result exists.
- **Date & freshness header** on results — the location-local date ("Forecast for Monday,
  January 12"), the forecast window, and an "Updated …" stamp in the location's timezone.
- **Collapsible Weather details** — current temp, overnight low, daytime high, window
  snowfall, wind gusts, snow on the ground, and winter-alert status, plus the hourly
  outlook with an accessible text equivalent. Collapsed by default on small screens.
- **Honest local estimate counter** — "N estimates run on this device", stored only in
  `localStorage`, shown subtly in the footer and About tab, with a reset in Data.
- **Tabbed Settings modal** (Appearance / Weather / Data / About), wider (~760px), with
  accessible tab semantics, arrow-key navigation, and selectable pills instead of long
  radio walls. Focus trapping, Escape, click-outside, and X-close are preserved.

### Changed
- **Wider desktop workspace** (~1080px): full-width search + school controls across the
  top and a two-column result workspace (factor breakdown beside weather details) on large
  screens. Readable line lengths, a clean single-column mobile layout, accessible touch
  targets, and no horizontal overflow; content is not stretched edge-to-edge on ultrawide.
- **Themes simplified** to **System / Light / Dark**. The header sun/moon toggle now
  switches Light↔Dark only, and a read-only "System detected: Dark/Light" badge appears
  while Theme is set to System.
- **Atmosphere** effects are tuned separately for light and dark backgrounds and remain
  independent of theme (Auto / Winter / Spring / Summer / Fall / Off). Snowfall is still
  available via Atmosphere: Winter.
- **No more animation replays** — changing Theme, Atmosphere, Accent hue, Motion, or
  Temperature unit (or scoring inputs) updates values in place; the full result entrance
  animation only runs after a new successful forecast.
- **Loading & error states** — friendlier messages (no raw technical errors), a clear
  **Try again** action that re-runs your last action, and the coordinate fallback when
  reverse geocoding fails.

### Removed
- The **Midnight snow** theme (plus the unused `frost`/`slate` theme tokens). Any stored
  `midnight`/`midnight-snow`/`frost`/`slate` preference migrates safely to **Dark**.

### Open source
- Documented the **MIT License** (root `LICENSE`, `package.json`, README), added a
  `CONTRIBUTING.md`, and added compact footer links to the license and source.

## [1.0.0-beta.2] — 2026-06-06

A focused **polish beta**. No changes to the prediction engine, no backend, no new
build step or framework. The GitHub Pages URL stays on the `/snowsignal/` subpath.

### Added
- **Seasonal atmosphere** — a lightweight, decorative ambient layer (drifting snow,
  petals, warm motes, or leaves). New **Atmosphere** setting: Auto, Winter, Spring,
  Summer, Fall, Off. **Auto** reads the location's hemisphere + local date; Midnight
  snow keeps a snowfall identity year-round. Fully gated by the motion preference and
  `prefers-reduced-motion`; the layer never captures clicks.
- **School-calendar reminders** — clearly-labeled, dismissible heuristic notices for
  likely **summer break** (hemisphere-aware), **winter break**, and **weekends**. Isolated
  in a pure, tested module (`js/calendarContext.js`); never claims to know a real district
  calendar.
- **Forecast-window label** on results (e.g. "Forecast window: Tonight 6 PM – tomorrow 9 AM").
- **Copy share link** button beside Copy summary; share URLs omit default values.
- **Friendly geolocation labels** — "My location" now reverse-geocodes to e.g.
  "Owosso, Michigan, US" (keyless BigDataCloud endpoint), falling back to coordinates.
- **Reworked Settings dialog** grouped into Appearance / Weather / Data / About, with
  one-tap data resets (clear recent, clear saved, reset school settings, reset preferences)
  behind confirmation prompts, plus version, changelog, and roadmap links.
- **Restrained UI motion** — animated gauges (count-up + sweep), filling factor bars,
  staggered hourly cards, modal entrance/exit, autocomplete and toast entrances, smoother
  theme transitions, and a subtle snowflake-logo drift — all respecting the motion setting.
- New automated tests for season/calendar heuristics, atmosphere motion-gating, clean-URL
  share building, the reverse-geocode parser, persistence/reset behavior, and GitHub Pages
  relative-path safety.

### Changed
- **Larger, more polished desktop layout** — wider main column (~880px), roomier spacing
  and typography, and a two-column factor breakdown on wide screens. The mobile one-column
  layout and touch targets are preserved; no horizontal overflow.
- **Cleaner URLs** — the address bar is no longer rewritten during ordinary use.
  Preferences persist via `localStorage`; a scenario URL is only produced when you click a
  share action.
- **Input validation** — snow-day fields reject negatives and cap at a sane maximum. "Used"
  may still exceed "allowed" (it happens), now with an explanatory note that this can make a
  district more reluctant to close.

### Persistence
- Added `atmosphere` to the persisted settings. All preferences — theme, atmosphere, motion,
  temperature unit, school type, area type, district sensitivity, snow days used, days allowed,
  saved locations, and recent locations — persist in `localStorage`.

## [1.0.0-beta.1] — 2026-06

- First public beta of the rebuilt, modular app: transparent deterministic prediction engine
  (closure %, delay %, confidence, factor breakdown), Open-Meteo data, optional NWS alerts,
  themes, saved/recent locations, shareable links, and a zero-dependency test suite.

### Fixed (hotfix after beta.1)
- Settings modal could render on load and resist dismissal; added a global `[hidden]` override.
