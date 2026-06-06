# Snow Day Calculator

A free, modern, **fully static** snow day calculator. It pulls live weather from
[Open-Meteo](https://open-meteo.com) and (for U.S. locations) official winter alerts
from the [National Weather Service](https://www.weather.gov), then runs a transparent,
deterministic scoring engine to estimate the chance that school is **closed** or **delayed**.

No backend. No API keys. No sign-up. No tracking. It runs entirely in the browser and
deploys to GitHub Pages as-is.

## Features

- 🔎 Search by **ZIP / postal code, city, or town**, use **browser geolocation**, or open a **shared link**
- ❄️ Separate **closure %** and **2-hour delay %**, a **confidence** level, a plain-English
  recommendation, and a **visible factor breakdown** (you can see exactly what's driving the number)
- 🌡️ Accounts for overnight snow, **snow during the morning commute**, **freezing rain / ice**,
  temperature & wind chill, wind gusts, low visibility, existing snow depth, precip probability,
  official winter alerts, storm timing, district sensitivity, area type, school type, and snow days used
- 🎨 **Light / dark / midnight-snow** themes (plus frost & slate), with `prefers-color-scheme` defaults
- 💾 **Saved locations**, **recent searches**, **cached forecasts** (offline-friendly), and **shareable URLs**
- 📋 One-click **copy summary**, an **hourly timeline**, expandable **advanced settings**, loading
  skeletons, and clear error states
- ♿ Accessible: keyboard navigation, focus management, `aria-live` results, and **reduced-motion** support

## How the prediction works

The engine (`js/engine.js`) is a **pure, deterministic function** — no randomness, no fabricated
historical data, no accuracy claims. It adds up named, weighted factors and maps the total to a
percentage. **Ice risk** and **snow during the morning commute** are intentionally the two heaviest
factors. Every factor is shown in the UI with its contribution, so the number is explainable rather
than a black box.

- **Closure %** — weighted sum of all factors, scaled and capped at 99%.
- **Delay %** — a separate profile that favors morning-timed storms that clear; it's suppressed when a
  full closure is already likely (a district would just close instead).
- **Confidence** — reflects how *clear-cut the inputs are* (alert agreement, precip certainty, whether
  the result sits in a mushy middle), **not** a probability that the estimate is correct.

The weights live at the top of `js/engine.js` and are documented inline so you can tune them.

## Project structure

```
index.html          # markup; loads js/main.js as an ES module
css/                # tokens (themes) + base + components, joined by main.css
js/
  engine.js         # pure prediction engine (unit-tested)
  weather.js        # Open-Meteo fetch + forecast→engine-input mapping
  geocode.js        # Open-Meteo geocoding (city / ZIP / postal)
  alerts.js         # optional NWS winter alerts (fails gracefully)
  storage.js        # localStorage: settings, saved/recent, cached forecasts
  urlState.js       # shareable URL query params
  geolocation.js    # browser geolocation wrapper
  ui.js             # all DOM rendering + accessibility
  main.js           # orchestrator wiring events → fetch → engine → ui
tests/              # node:test unit tests + fixtures
```

## Running locally

ES modules must be served over HTTP (opening `index.html` via `file://` will not work). Any static
server is fine:

```bash
# Python (no install)
python3 -m http.server 8000
#   → open http://localhost:8000

# or with this repo's helper script
npm run serve
```

## Tests

Tests use Node's built-in test runner — **zero dependencies, no install required** (Node 18+):

```bash
npm test        # or: node --test
```

They cover the engine (monotonicity, weighting, closure-vs-delay separation, confidence,
determinism, edge cases), the Open-Meteo→engine mapping (window bucketing, unit conversion),
the NWS alert summarizer, and the storage layer.

## Deploying to GitHub Pages

1. Push to GitHub.
2. **Settings → Pages → Build and deployment → Source: "Deploy from a branch."**
3. Choose your branch and the **`/ (root)`** folder, then save.
4. Your site goes live at `https://<user>.github.io/<repo>/`.

Notes:
- A `.nojekyll` file is included so GitHub Pages serves the `js/` and `css/` folders untouched.
- All asset paths are **relative**, so the app works under the project subpath without changes.
- There is no build step — the files you see are the files that ship.

## Privacy

- Everything runs in your browser. There is **no backend** and **no analytics**.
- Saved locations, recent searches, settings, and cached forecasts are stored **only in your
  browser's `localStorage`** and never leave your device.
- When you look up a location, only its **coordinates** are sent to Open-Meteo (and, for U.S.
  points, to the NWS) to fetch the forecast/alerts. Geolocation, if used, stays on your device
  except for that coordinate lookup.

## Limitations

- This is an **estimate for planning and fun** — it is **not affiliated with any school district**
  and cannot know local policies, road crews, or administrator judgment. **Always rely on official
  announcements.**
- It uses **forecast** data, which can be wrong; predictions are only as good as the forecast.
- NWS alerts are **U.S.-only**; outside the U.S. the app still works but shows no official alerts.
- District sensitivity, area type, and snow-days-used are **your inputs** — adjust them to match
  your district.

## Attribution

- Weather & geocoding: [Open-Meteo](https://open-meteo.com) (free, no key, CC BY 4.0).
- U.S. winter alerts: [National Weather Service / api.weather.gov](https://www.weather.gov) (public domain).

## License

MIT — see `package.json`.
