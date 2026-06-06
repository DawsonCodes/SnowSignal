# SnowSignal Roadmap

_Know before the bell._ — A transparent snow-day and school-delay predictor.

This roadmap is a direction, not a promise. Items may shift as we learn from
real-world beta testing. The app is served from the `/snowsignal/` GitHub Pages
project subpath, and all asset paths are relative so that URL remains stable.

## v1.0.0-beta.1
The rebuilt, modular app released for browser testing. Transparent deterministic
prediction engine (closure %, delay %, confidence, factor breakdown), Open-Meteo
data, optional NWS alerts, themes, saved/recent locations, shareable links, and a
zero-dependency test suite.

## v1.0.0-beta.2 — current
A polish beta on the same engine: roomier desktop layout, seasonal atmosphere with an
Auto mode, restrained UI motion, dismissible school-calendar reminders, cleaner URL
behavior with explicit share links, friendlier reverse-geocoded geolocation labels, a
reworked grouped Settings dialog with data resets, and stronger input validation. See
[CHANGELOG.md](CHANGELOG.md).

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
