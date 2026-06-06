// palette.js
// PURE seasonal-palette resolution. Maps the Seasonal palette preference to a
// constrained accent hue (saturation/lightness stay locked in CSS) and a
// time-of-day "daypart". Imports only the pure season helper, touches no DOM,
// clock, or network — every input is passed in, so it runs in the browser and
// under `node --test`.

import { seasonFromLatitude } from "./calendarContext.js";

// Restrained seasonal accent hues (degrees). Kept inside safe ranges; the fixed
// saturation/lightness in tokens.css guarantees readable contrast for any of them.
export const PALETTE_HUES = {
  winter: 200, // icy blue / cyan
  spring: 325, // soft pink / lavender
  summer: 140, // fresh green
  fall: 32, // amber / orange
};

// The neutral brand hue used for Custom with no chosen hue yet.
export const DEFAULT_HUE = 217;

const SEASONS = ["winter", "spring", "summer", "fall"];

/**
 * Resolve which season a palette renders. Explicit seasons pass through; "auto"
 * follows the location's latitude + local date (southern hemisphere inverts via
 * seasonFromLatitude); "custom" has no season.
 * @returns {'winter'|'spring'|'summer'|'fall'|null}
 */
export function resolvePaletteSeason({ palette, lat, date } = {}) {
  if (SEASONS.includes(palette)) return palette;
  if (palette === "auto") return seasonFromLatitude(lat, date || new Date());
  return null; // custom
}

/**
 * Resolve the accent hue to apply for the current palette settings.
 * @param {object} opts
 * @param {string} opts.palette      auto|winter|spring|summer|fall|custom
 * @param {number|null} opts.accentHue  the user's custom hue (used when Custom)
 * @param {number|null} opts.lat
 * @param {Date} [opts.date]
 * @returns {number} hue 0..360
 */
export function resolvePaletteHue({ palette, accentHue, lat, date } = {}) {
  if (palette === "custom") return Number.isFinite(accentHue) ? accentHue : DEFAULT_HUE;
  const season = resolvePaletteSeason({ palette, lat, date });
  return season ? PALETTE_HUES[season] : DEFAULT_HUE;
}

/**
 * Coarse time-of-day bucket from an hour (0..23), used only to vary ambient
 * intensity subtly under the Auto palette. Not a separate theme.
 * @returns {'day'|'evening'|'night'}
 */
export function daypartFromHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return "day";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
