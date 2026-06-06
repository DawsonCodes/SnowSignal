// urlState.js
// Shareable scenario links. As of v1.0.0-beta.2 the address bar is NOT updated
// during normal use — preferences persist via localStorage instead, keeping the URL
// clean. A scenario URL is only built when the user explicitly clicks a share action.
//
// On load we still READ any query params so a shared link reproduces a scenario.
// Precedence (applied by main.js): URL params > stored settings > defaults.

import { round } from "./format.js";

const NUM_KEYS = new Set(["lat", "lon", "sens", "used", "allowed"]);

// Values equal to these are omitted from generated share URLs to keep them short.
export const SHARE_DEFAULTS = {
  school: "high",
  area: "suburban",
  sens: 0.5,
  used: 0,
  allowed: 5,
  unit: "fahrenheit",
};

/** Parse the current location's query string into a plain object. */
export function readUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const state = {};
  for (const [key, value] of params.entries()) {
    state[key] = NUM_KEYS.has(key) ? Number(value) : value;
  }
  return state;
}

/**
 * Build the query string for a scenario, omitting any value that equals its
 * default. PURE (no DOM) so it is easy to unit-test.
 * @param {object} state  { loc, lat, lon, school, area, sens, used, allowed, unit }
 * @param {object} [defaults]
 * @returns {string} query string without a leading "?"
 */
export function buildShareParams(state = {}, defaults = SHARE_DEFAULTS) {
  const params = new URLSearchParams();
  const set = (k, v) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  };
  const setUnlessDefault = (k, v) => {
    if (v === undefined || v === null || v === "") return;
    if (String(v) === String(defaults[k])) return;
    params.set(k, String(v));
  };

  // Scenario identity — always included when present.
  set("loc", state.loc);
  if (Number.isFinite(state.lat)) set("lat", round(state.lat, 4));
  if (Number.isFinite(state.lon)) set("lon", round(state.lon, 4));

  // Context — only when it differs from the defaults.
  setUnlessDefault("school", state.school);
  setUnlessDefault("area", state.area);
  if (Number.isFinite(state.sens)) setUnlessDefault("sens", state.sens);
  if (Number.isFinite(state.used)) setUnlessDefault("used", state.used);
  if (Number.isFinite(state.allowed)) setUnlessDefault("allowed", state.allowed);
  setUnlessDefault("unit", state.unit);

  return params.toString();
}

/**
 * Build an absolute shareable URL for the copy-share-link button. Uses the live
 * origin + pathname, so it stays correct under the `/snowsignal/` project subpath.
 */
export function buildShareUrl(state) {
  const query = buildShareParams(state);
  const base = `${window.location.origin}${window.location.pathname}`;
  return query ? `${base}?${query}` : base;
}
