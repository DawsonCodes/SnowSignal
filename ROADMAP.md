# SnowSignal Roadmap

_Know before the bell._ — A transparent snow-day and school-delay predictor.

This roadmap is a direction, not a promise. Items may shift as we learn from
real-world beta testing. The GitHub repository name stays `snow-day-calculator`
during beta so the GitHub Pages URL remains stable.

## v1.0.0-beta.1 — current
The rebuilt, modular app released for browser testing. Transparent deterministic
prediction engine (closure %, delay %, confidence, factor breakdown), Open-Meteo
data, optional NWS alerts, themes, saved/recent locations, shareable links, and a
zero-dependency test suite.

## v1.0.0 — stable
Promote to a stable release after bug fixes and real-world testing across a range
of locations, devices, and storms.

## v1.1.0
- Optional **local** outcome feedback ("was school actually closed?") stored only on-device
- Location-specific calibration informed by that local feedback
- Settings polish and clearer defaults
- A plain-language privacy explanation in the UI
- Improved copied-summary formatting

## v1.2.0
- Installable **PWA** support (add to home screen)
- Improved sharing (richer links / preview)
- Offline cached results surfaced more clearly

## v2.0.0
- Optional, privacy-conscious **anonymous** outcome collection and broader model
  calibration — only if the project gains enough users to make it meaningful, and
  only on an explicit opt-in basis.
