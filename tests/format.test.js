// Tests for the pure conversion / formatting helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clamp,
  fToC,
  cToF,
  mmToIn,
  mToMi,
  mToIn,
  formatTemp,
  formatInches,
  formatPlaceLabel,
  formatHourLabel,
  formatLocalDate,
  formatUpdatedAt,
} from "../js/format.js";

test("clamp keeps values in range and rejects NaN", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
  assert.equal(clamp(NaN, 1, 10), 1);
});

test("temperature conversions round-trip at boundary values", () => {
  for (const f of [-10, 0, 32, 40, 98.6]) {
    assert.ok(Math.abs(cToF(fToC(f)) - f) < 1e-9);
  }
  assert.equal(Math.round(fToC(32)), 0);
  assert.equal(Math.round(cToF(0)), 32);
});

test("length conversions", () => {
  assert.ok(Math.abs(mmToIn(25.4) - 1) < 1e-9);
  assert.ok(Math.abs(mToMi(1609.344) - 1) < 1e-9);
  assert.ok(Math.abs(mToIn(1) - 39.3701) < 1e-3);
});

test("formatTemp respects unit and handles bad input", () => {
  assert.equal(formatTemp(32, "fahrenheit"), "32°F");
  assert.equal(formatTemp(32, "celsius"), "0°C");
  assert.equal(formatTemp(NaN, "fahrenheit"), "--");
});

test("formatInches rounds to one decimal", () => {
  assert.equal(formatInches(3.44), '3.4"');
  assert.equal(formatInches(NaN), "--");
});

test("formatPlaceLabel joins and de-duplicates parts", () => {
  assert.equal(
    formatPlaceLabel({ name: "Laingsburg", admin1: "Michigan", country_code: "US" }),
    "Laingsburg, Michigan, US"
  );
  assert.equal(formatPlaceLabel(null), "");
});

test("formatHourLabel converts to 12-hour clock", () => {
  assert.equal(formatHourLabel("2026-01-10T00:00"), "12 AM");
  assert.equal(formatHourLabel("2026-01-10T13:00"), "1 PM");
  assert.equal(formatHourLabel("2026-01-10T07:00"), "7 AM");
});

test("formatLocalDate renders a friendly weekday + month + day in a given zone", () => {
  // A fixed UTC instant; in America/Detroit (UTC-5 in January) it is still Jan 12.
  const inst = new Date("2026-01-12T17:30:00Z");
  assert.equal(formatLocalDate(inst, "America/Detroit"), "Monday, January 12");
  // Invalid timezone falls back to the local zone without throwing.
  assert.doesNotThrow(() => formatLocalDate(inst, "Not/AZone"));
  assert.equal(formatLocalDate("nonsense"), "");
});

test("formatUpdatedAt renders a freshness stamp with the zone abbreviation", () => {
  const inst = new Date("2026-01-12T20:27:00Z"); // 3:27 PM EST in America/Detroit
  const s = formatUpdatedAt(inst, "America/Detroit");
  assert.match(s, /^Updated 3:27\s?PM\s+EST$/);
  assert.equal(formatUpdatedAt("nonsense"), "");
});
