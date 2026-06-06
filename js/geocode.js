// geocode.js
// Look up a place (city, town, ZIP, or postal code) using Open-Meteo's free
// geocoding API. No API key required. Returns lightweight place objects.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * @typedef {Object} Place
 * @property {string} name
 * @property {string} [admin1]      state / region
 * @property {string} [country]
 * @property {string} [country_code]
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * Search for places matching a free-text query.
 * @param {string} query
 * @param {{count?:number, signal?:AbortSignal}} [opts]
 * @returns {Promise<Place[]>}
 */
export async function searchPlaces(query, { count = 5, signal } = {}) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 2) return [];

  const url =
    `${GEOCODE_URL}?name=${encodeURIComponent(trimmed)}` +
    `&count=${count}&language=en&format=json`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Location lookup failed. Please try again.");

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No matching city, town, or ZIP found.");
  }
  return data.results;
}

/** Convenience: return only the first/best match. */
export async function findPlace(query, opts) {
  const results = await searchPlaces(query, { ...opts, count: 1 });
  return results[0];
}

/** True if a place is in the United States (used to decide whether to query NWS). */
export function isUnitedStates(place) {
  if (!place) return false;
  return place.country_code === "US" || place.country === "United States";
}
