# Changelog

All notable changes to SnowSignal are documented here. This project is in **public
beta**; versions follow [semantic versioning](https://semver.org) with pre-release tags.

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
