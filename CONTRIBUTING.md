# Contributing to SnowSignal

Thanks for your interest in improving SnowSignal — a transparent, free, **fully
static** snow-day and school-delay predictor. Contributions are welcome under the
project's [MIT License](LICENSE).

## Reporting bugs

Please open a **GitHub Issue** at
<https://github.com/DawsonCodes/snowsignal/issues>. A good report includes:

- what you did and what you expected to happen;
- what actually happened (screenshots help);
- your browser/OS, and the URL or location you searched, if relevant.

## Proposing changes

1. **Fork** the repository (or create a branch) and base your work on the latest `main`.
2. Create a focused **feature branch**, e.g. `feature/short-description`.
3. Make your change, keeping commits small and descriptive.
4. **Open a pull request** into `main` describing the change and the reasoning. Draft PRs
   are welcome while you're still iterating.

## Ground rules

SnowSignal deploys as a static site to GitHub Pages under `/snowsignal/`, with **no build
step**. Please keep it that way:

- **Preserve the static GitHub Pages deployment.** No backend, no server-side code, and no
  build/transpile step. Asset paths must stay **relative** so the app keeps working under
  the `/snowsignal/` subpath.
- **No framework.** The app is vanilla ES modules; please don't introduce one.
- **New dependencies, external APIs, analytics, or tracking require justification.** The app
  ships with zero runtime dependencies and collects nothing. Any addition must be explained
  in the PR and should avoid paid services, secret keys, and anything that phones home.
- **Keep the prediction engine transparent and deterministic.** `js/engine.js` is pure
  (no DOM, network, clock, or randomness). Document any weight or threshold changes inline.
- **Preserve accessibility:** keyboard navigation, focus trapping, reduced-motion support,
  and mobile usability.
- **Don't overstate accuracy.** SnowSignal is a planning estimate and is not affiliated with
  any school district; always defer to official announcements.

## Running the project

No install step is needed — the project has no dependencies.

```sh
# Run the full test suite (Node 18+ built-in runner)
npm test          # or: node --test

# Serve locally to check the app in a browser
npm run serve     # or: python3 -m http.server 8000
```

Then open the served URL (the test suite also guards relative-path safety for the
`/snowsignal/` subpath).

## Before you submit

- **Run the full test suite** (`node --test`) and make sure it passes.
- Add or update tests for behavior you change.
- Check the browser console for errors and remove any debugging leftovers.
- Verify both desktop and mobile layouts, and that reduced-motion is respected.

Thank you for helping keep SnowSignal fast, private, and honest!
