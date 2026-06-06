// calendarContext.js
// PURE, deterministic helpers for seasonal + school-calendar awareness.
//
// Imports nothing, touches no DOM/clock/network — every function takes its date
// (and latitude, where hemisphere matters) as arguments, so the same code runs in
// the browser and under `node --test`. These are deliberately *heuristics*: we never
// claim to know a specific district's calendar.

const NORTHERN_SEASON_BY_MONTH = [
  "winter", // Jan
  "winter", // Feb
  "spring", // Mar
  "spring", // Apr
  "spring", // May
  "summer", // Jun
  "summer", // Jul
  "summer", // Aug
  "fall", // Sep
  "fall", // Oct
  "fall", // Nov
  "winter", // Dec
];

const OPPOSITE_SEASON = {
  winter: "summer",
  summer: "winter",
  spring: "fall",
  fall: "spring",
};

/** True when a latitude is in (or assumed to be in) the northern hemisphere. */
export function isNorthern(lat) {
  // Unknown latitude (no location yet) falls back to northern hemisphere.
  return !(Number.isFinite(lat) && lat < 0);
}

/**
 * Meteorological season for a date at a given latitude.
 * Southern-hemisphere latitudes invert the season.
 * @param {number|null|undefined} lat
 * @param {Date} date
 * @returns {'winter'|'spring'|'summer'|'fall'}
 */
export function seasonFromLatitude(lat, date) {
  const month = (date instanceof Date ? date : new Date(date)).getMonth();
  const northern = NORTHERN_SEASON_BY_MONTH[month];
  return isNorthern(lat) ? northern : OPPOSITE_SEASON[northern];
}

/**
 * Resolve which ambient atmosphere to render from the user's preference.
 * @param {object} opts
 * @param {'auto'|'winter'|'spring'|'summer'|'fall'|'off'} opts.pref
 * @param {string} opts.theme           current concrete theme (e.g. "midnight")
 * @param {number|null} opts.lat
 * @param {Date} opts.date
 * @returns {'winter'|'spring'|'summer'|'fall'|null}  null = no ambient effect
 */
export function resolveAtmosphere({ pref, theme, lat, date }) {
  if (pref === "off") return null;
  if (pref === "winter" || pref === "spring" || pref === "summer" || pref === "fall") {
    return pref;
  }
  // "auto": Midnight snow keeps a snowfall identity year-round; otherwise follow
  // the local season.
  if (theme === "midnight") return "winter";
  return seasonFromLatitude(lat, date);
}

/**
 * Build any school-calendar reminder notices that apply to a forecast target date.
 * These are clearly-labeled heuristics, never authoritative calendar data.
 * @param {object} opts
 * @param {Date} opts.date   the forecast target date (local)
 * @param {number|null} [opts.lat]
 * @returns {{id:string, title:string, message:string}[]}
 */
export function getCalendarNotices({ date, lat } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return [];
  const month = d.getMonth(); // 0-11
  const day = d.getDate();
  const weekday = d.getDay(); // 0 = Sun, 6 = Sat
  const northern = isNorthern(lat);
  const notices = [];

  // Weekend — the forecast target isn't a normal school day.
  if (weekday === 0 || weekday === 6) {
    notices.push({
      id: "weekend",
      title: "Weekend detected",
      message: "This estimate may not apply to a regular school day.",
    });
  }

  // Summer break — broad window. June–August (N) inverts to December–February (S).
  const northernSummer = month >= 5 && month <= 7;
  const southernSummer = month === 11 || month === 0 || month === 1;
  if ((northern && northernSummer) || (!northern && southernSummer)) {
    notices.push({
      id: "summer-break",
      title: "Summer break may be in effect",
      message:
        "SnowSignal is showing weather data for testing. Check your district calendar for the official schedule.",
    });
  }

  // Winter break — broad late-December / early-January window. This is a
  // northern-hemisphere school concept; in the south the summer notice already
  // covers this period.
  const inWinterBreakWindow = (month === 11 && day >= 15) || (month === 0 && day <= 7);
  if (northern && inWinterBreakWindow) {
    notices.push({
      id: "winter-break",
      title: "Winter break may be in effect",
      message:
        "School schedules vary by district. Check your local calendar before relying on this estimate.",
    });
  }

  return notices;
}

/**
 * Human-readable label for the overnight→morning window the engine evaluates,
 * relative to `now`. Mirrors weather.js: before ~11am we judge today's school
 * morning, otherwise tomorrow's. The engine reads conditions from ~6 PM the prior
 * evening through ~9 AM on the target morning.
 * @param {Date} now
 * @returns {string}
 */
export function describeForecastWindow(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const hour = d.getHours();
  const targetIsTomorrow = hour >= 11;
  return targetIsTomorrow
    ? "Tonight 6 PM – tomorrow 9 AM"
    : "Overnight – this morning 9 AM";
}

/** The forecast target date (local) the engine will judge, relative to `now`. */
export function forecastTargetDate(now = new Date()) {
  const d = now instanceof Date ? new Date(now) : new Date(now);
  if (d.getHours() >= 11) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
