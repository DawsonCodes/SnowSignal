// geocode.js
// Look up a place (city, town, ZIP, or postal code) using Open-Meteo's free
// geocoding API. No API key required. Returns lightweight place objects.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
// Open-Meteo has no reverse endpoint. BigDataCloud's reverse-geocode-client API is
// free, keyless, and CORS-enabled — ideal for turning "My location" coordinates into
// a friendly label. We always fall back to raw coordinates if it is unavailable.
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

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

/**
 * Turn a BigDataCloud reverse-geocode payload into a Place. PURE (no fetch), so the
 * label-building logic is unit-testable. Returns null when nothing usable is present.
 * @param {object} data
 * @param {number} lat
 * @param {number} lon
 * @returns {Place|null}
 */
export function parseReverseGeocode(data, lat, lon) {
  if (!data || typeof data !== "object") return null;
  const name = data.city || data.locality || data.principalSubdivision || null;
  if (!name) return null;
  const place = { name, latitude: lat, longitude: lon };
  if (data.principalSubdivision && data.principalSubdivision !== name) {
    place.admin1 = data.principalSubdivision;
  }
  if (data.countryCode) place.country_code = data.countryCode;
  return place;
}

/**
 * Reverse-geocode a coordinate into a friendly Place. The exact lat/lon are kept on
 * the returned object so forecast accuracy is unaffected. Throws on failure; callers
 * should fall back to a coordinate label.
 */
export async function reverseGeocode(lat, lon, { signal } = {}) {
  const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Reverse geocoding failed.");
  const place = parseReverseGeocode(await res.json(), lat, lon);
  if (!place) throw new Error("No place found for those coordinates.");
  return place;
}

/** True if a place is in the United States (used to decide whether to query NWS). */
export function isUnitedStates(place) {
  if (!place) return false;
  return place.country_code === "US" || place.country === "United States";
}
