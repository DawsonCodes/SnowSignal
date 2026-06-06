// alerts.js
// Optional U.S. winter alerts from the National Weather Service (api.weather.gov).
// No API key. NWS sends permissive CORS headers, so the browser can call it directly.
//
// IMPORTANT: this is strictly additive. ANY failure (CORS, offline, non-US point,
// timeout, bad JSON) resolves to EMPTY_ALERTS and never throws — the prediction
// works fully without it. We do NOT try to set a User-Agent header: browsers forbid
// it, and NWS serves browser requests without one.

const ALERTS_URL = "https://api.weather.gov/alerts/active";

export const EMPTY_ALERTS = {
  hasWinterAlert: false,
  alertSeverity: null,
  headline: "",
  event: "",
};

// Winter-related event names → our internal severity ranking.
const WINTER_EVENTS = new Map([
  ["Blizzard Warning", "warning"],
  ["Ice Storm Warning", "warning"],
  ["Winter Storm Warning", "warning"],
  ["Wind Chill Warning", "warning"],
  ["Winter Storm Watch", "watch"],
  ["Wind Chill Watch", "watch"],
  ["Winter Weather Advisory", "advisory"],
  ["Wind Chill Advisory", "advisory"],
  ["Freezing Rain Advisory", "advisory"],
]);

const SEVERITY_RANK = { warning: 3, watch: 2, advisory: 1 };

/**
 * Reduce an NWS alerts FeatureCollection to a single winter summary.
 * Pure — safe to unit-test with a fixture.
 */
export function summarizeWinterAlerts(data) {
  const features = (data && data.features) || [];
  let best = null;

  for (const f of features) {
    const event = f?.properties?.event;
    const severity = WINTER_EVENTS.get(event);
    if (!severity) continue; // not a winter alert → ignore
    if (!best || SEVERITY_RANK[severity] > SEVERITY_RANK[best.alertSeverity]) {
      best = {
        hasWinterAlert: true,
        alertSeverity: severity,
        event,
        headline: f.properties.headline || event,
      };
    }
  }
  return best || EMPTY_ALERTS;
}

/**
 * Fetch active winter alerts for a coordinate. Never throws.
 * @param {number} lat
 * @param {number} lon
 * @param {{signal?:AbortSignal}} [opts]
 * @returns {Promise<typeof EMPTY_ALERTS>}
 */
export async function fetchWinterAlerts(lat, lon, { signal } = {}) {
  try {
    const url = `${ALERTS_URL}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/geo+json" },
      signal,
    });
    if (!res.ok) return EMPTY_ALERTS;
    const data = await res.json();
    return summarizeWinterAlerts(data);
  } catch {
    return EMPTY_ALERTS; // CORS / offline / non-US / timeout — degrade silently
  }
}
