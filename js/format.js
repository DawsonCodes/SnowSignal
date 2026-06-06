// format.js
// Pure helper functions: unit conversions and small text helpers.
// No DOM, no fetch, no globals — everything here is easy to unit-test.

/** Clamp a number into the inclusive range [min, max]. */
export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Round to a given number of decimal places (default 0). */
export function round(value, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

// --- Temperature ---------------------------------------------------------

/** Fahrenheit -> Celsius. */
export function fToC(f) {
  return ((f - 32) * 5) / 9;
}

/** Celsius -> Fahrenheit. */
export function cToF(c) {
  return (c * 9) / 5 + 32;
}

/**
 * Format a Fahrenheit temperature for display in the chosen unit.
 * @param {number} tempF
 * @param {'fahrenheit'|'celsius'} unit
 */
export function formatTemp(tempF, unit) {
  if (!Number.isFinite(tempF)) return "--";
  if (unit === "celsius") return `${Math.round(fToC(tempF))}°C`;
  return `${Math.round(tempF)}°F`;
}

// --- Distance / length ---------------------------------------------------

/** Millimeters -> inches. */
export function mmToIn(mm) {
  return mm / 25.4;
}

/** Meters -> inches. */
export function mToIn(m) {
  return m * 39.3701;
}

/** Meters -> miles. */
export function mToMi(m) {
  return m / 1609.344;
}

// --- Text helpers --------------------------------------------------------

/** Format inches of snow, e.g. 3.4 -> `3.4"`. */
export function formatInches(inches) {
  if (!Number.isFinite(inches)) return "--";
  return `${round(inches, 1)}"`;
}

/**
 * Turn a place result into a readable label, e.g. "Laingsburg, MI, US".
 * Accepts the shape returned by geocode.js (name/admin1/country_code).
 */
export function formatPlaceLabel(place) {
  if (!place) return "";
  const parts = [place.name, place.admin1, place.country_code || place.country].filter(
    (p) => p && String(p).trim().length > 0
  );
  // De-duplicate consecutive identical parts (some APIs repeat name/admin1).
  return parts.filter((p, i) => p !== parts[i - 1]).join(", ");
}

// --- Date + freshness ----------------------------------------------------

/** Format a date/time in a given IANA timezone, falling back to the local zone. */
function formatWithZone(d, opts, timeZone) {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(d);
    } catch {
      /* invalid timezone → fall back to the runtime's local zone */
    }
  }
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

/**
 * Friendly local date for the forecast header, e.g. "Monday, January 12".
 * @param {Date|number|string} date
 * @param {string} [timeZone]  IANA zone (e.g. "America/Detroit"); local if omitted/invalid.
 */
export function formatLocalDate(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return formatWithZone(d, { weekday: "long", month: "long", day: "numeric" }, timeZone);
}

/**
 * Forecast freshness stamp, e.g. "Updated 3:27 PM EST".
 * @param {Date|number|string} ts
 * @param {string} [timeZone]
 */
export function formatUpdatedAt(ts, timeZone) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const time = formatWithZone(
    d,
    { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
    timeZone
  );
  return `Updated ${time}`;
}

/** Pretty 12-hour clock label from an ISO-ish local time string. */
export function formatHourLabel(isoLocal) {
  const timePart = String(isoLocal).split("T")[1] || "";
  const hour = parseInt(timePart.slice(0, 2), 10);
  if (Number.isNaN(hour)) return "";
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}
