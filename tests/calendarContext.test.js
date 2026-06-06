// Tests for the pure seasonal + school-calendar heuristics.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNorthern,
  seasonFromLatitude,
  resolveAtmosphere,
  getCalendarNotices,
  describeForecastWindow,
  forecastTargetDate,
} from "../js/calendarContext.js";

// Use local-time dates (no trailing Z) so getMonth/getDay are stable across runners.
const d = (s) => new Date(s);

test("isNorthern treats unknown latitude as northern", () => {
  assert.equal(isNorthern(42), true);
  assert.equal(isNorthern(-33), false);
  assert.equal(isNorthern(null), true);
  assert.equal(isNorthern(undefined), true);
});

test("seasonFromLatitude maps months in the northern hemisphere", () => {
  assert.equal(seasonFromLatitude(42, d("2026-01-15T12:00")), "winter");
  assert.equal(seasonFromLatitude(42, d("2026-04-15T12:00")), "spring");
  assert.equal(seasonFromLatitude(42, d("2026-07-15T12:00")), "summer");
  assert.equal(seasonFromLatitude(42, d("2026-10-15T12:00")), "fall");
  assert.equal(seasonFromLatitude(42, d("2026-12-15T12:00")), "winter");
});

test("seasonFromLatitude inverts for the southern hemisphere", () => {
  assert.equal(seasonFromLatitude(-33, d("2026-01-15T12:00")), "summer");
  assert.equal(seasonFromLatitude(-33, d("2026-07-15T12:00")), "winter");
  assert.equal(seasonFromLatitude(-33, d("2026-04-15T12:00")), "fall");
  assert.equal(seasonFromLatitude(-33, d("2026-10-15T12:00")), "spring");
});

test("resolveAtmosphere honors explicit choices and Off", () => {
  const base = { theme: "light", lat: 42, date: d("2026-07-15T12:00") };
  assert.equal(resolveAtmosphere({ ...base, pref: "off" }), null);
  assert.equal(resolveAtmosphere({ ...base, pref: "winter" }), "winter");
  assert.equal(resolveAtmosphere({ ...base, pref: "summer" }), "summer");
});

test("resolveAtmosphere auto follows the local season regardless of theme", () => {
  // Auto in July (northern) → summer, independent of the chosen theme.
  assert.equal(
    resolveAtmosphere({ pref: "auto", theme: "light", lat: 42, date: d("2026-07-15T12:00") }),
    "summer"
  );
  assert.equal(
    resolveAtmosphere({ pref: "auto", theme: "dark", lat: 42, date: d("2026-07-15T12:00") }),
    "summer"
  );
  // Auto in January (northern) → winter; snowfall still reachable via Atmosphere: Winter.
  assert.equal(
    resolveAtmosphere({ pref: "auto", theme: "dark", lat: 42, date: d("2026-01-15T12:00") }),
    "winter"
  );
  // An explicit choice is always respected.
  assert.equal(
    resolveAtmosphere({ pref: "winter", theme: "light", lat: 42, date: d("2026-07-15T12:00") }),
    "winter"
  );
});

test("weekend notice appears on Saturday and Sunday", () => {
  // 2026-06-06 is a Saturday, 2026-06-07 a Sunday, 2026-06-08 a Monday.
  assert.ok(getCalendarNotices({ date: d("2026-06-06T12:00"), lat: 42 }).some((n) => n.id === "weekend"));
  assert.ok(getCalendarNotices({ date: d("2026-06-07T12:00"), lat: 42 }).some((n) => n.id === "weekend"));
  assert.ok(!getCalendarNotices({ date: d("2026-06-08T12:00"), lat: 42 }).some((n) => n.id === "weekend"));
});

test("northern summer-break notice shows June–August", () => {
  const july = getCalendarNotices({ date: d("2026-07-15T12:00"), lat: 42 });
  assert.ok(july.some((n) => n.id === "summer-break"));
  const october = getCalendarNotices({ date: d("2026-10-15T12:00"), lat: 42 });
  assert.ok(!october.some((n) => n.id === "summer-break"));
});

test("southern hemisphere inverts the summer-break window to Dec–Feb", () => {
  // January in the south = summer break; July is not.
  const jan = getCalendarNotices({ date: d("2026-01-15T12:00"), lat: -33 });
  assert.ok(jan.some((n) => n.id === "summer-break"));
  const july = getCalendarNotices({ date: d("2026-07-15T12:00"), lat: -33 });
  assert.ok(!july.some((n) => n.id === "summer-break"));
});

test("winter-break reminder shows late December and early January (northern only)", () => {
  assert.ok(getCalendarNotices({ date: d("2026-12-24T12:00"), lat: 42 }).some((n) => n.id === "winter-break"));
  assert.ok(getCalendarNotices({ date: d("2026-01-03T12:00"), lat: 42 }).some((n) => n.id === "winter-break"));
  // Mid-December (before the 15th) is not in the window.
  assert.ok(!getCalendarNotices({ date: d("2026-12-10T12:00"), lat: 42 }).some((n) => n.id === "winter-break"));
  // Southern hemisphere does not get the winter-break notice (summer covers it).
  assert.ok(!getCalendarNotices({ date: d("2026-12-24T12:00"), lat: -33 }).some((n) => n.id === "winter-break"));
});

test("describeForecastWindow switches on time of day", () => {
  assert.equal(describeForecastWindow(d("2026-01-09T20:00")), "Tonight 6 PM – tomorrow 9 AM");
  assert.equal(describeForecastWindow(d("2026-01-10T07:00")), "Overnight – this morning 9 AM");
});

test("forecastTargetDate is today before 11am, tomorrow after", () => {
  assert.equal(forecastTargetDate(d("2026-01-10T07:00")).getDate(), 10);
  assert.equal(forecastTargetDate(d("2026-01-09T20:00")).getDate(), 10);
});
