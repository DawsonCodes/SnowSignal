// urlState.js
// Read and write the *shareable* slice of state via URL query parameters, so a
// link reproduces someone's exact scenario. Only shareable fields go here — never
// the cache or recent searches.
//
// Precedence (handled by main.js): URL params > stored settings > defaults.

const NUM_KEYS = new Set(["lat", "lon", "sens", "used", "allowed"]);

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
 * Write shareable state into the address bar without adding history entries.
 * @param {object} state  e.g. { loc, lat, lon, school, area, sens, used, unit, theme }
 */
export function writeUrlState(state) {
  const params = new URLSearchParams();
  const add = (k, v) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  };
  add("loc", state.loc);
  add("lat", state.lat);
  add("lon", state.lon);
  add("school", state.school);
  add("area", state.area);
  add("sens", state.sens);
  add("used", state.used);
  add("allowed", state.allowed);
  add("unit", state.unit);
  add("theme", state.theme);

  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  try {
    window.history.replaceState(null, "", url);
  } catch {
    /* replaceState can throw in sandboxed iframes — ignore. */
  }
}

/** Build an absolute shareable URL string for the copy-summary button. */
export function buildShareUrl(state) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
