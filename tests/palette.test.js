// Tests for the pure seasonal-palette resolver.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePaletteSeason,
  resolvePaletteHue,
  daypartFromHour,
  PALETTE_HUES,
  DEFAULT_HUE,
} from "../js/palette.js";

const d = (s) => new Date(s);

test("explicit seasons pass through regardless of date/location", () => {
  for (const s of ["winter", "spring", "summer", "fall"]) {
    assert.equal(resolvePaletteSeason({ palette: s, lat: 42, date: d("2026-07-15T12:00") }), s);
    assert.equal(resolvePaletteHue({ palette: s }), PALETTE_HUES[s]);
  }
});

test("custom has no season and uses the saved hue (brand default when unset)", () => {
  assert.equal(resolvePaletteSeason({ palette: "custom", lat: 42, date: d("2026-01-01T12:00") }), null);
  assert.equal(resolvePaletteHue({ palette: "custom", accentHue: 280 }), 280);
  assert.equal(resolvePaletteHue({ palette: "custom", accentHue: null }), DEFAULT_HUE);
});

test("auto palette resolves season from the location's latitude and date", () => {
  assert.equal(resolvePaletteSeason({ palette: "auto", lat: 42, date: d("2026-01-15T12:00") }), "winter");
  assert.equal(resolvePaletteSeason({ palette: "auto", lat: 42, date: d("2026-07-15T12:00") }), "summer");
  assert.equal(resolvePaletteHue({ palette: "auto", lat: 42, date: d("2026-07-15T12:00") }), PALETTE_HUES.summer);
});

test("auto palette inverts seasons in the Southern Hemisphere", () => {
  assert.equal(resolvePaletteSeason({ palette: "auto", lat: -33, date: d("2026-01-15T12:00") }), "summer");
  assert.equal(resolvePaletteSeason({ palette: "auto", lat: -33, date: d("2026-07-15T12:00") }), "winter");
  assert.equal(resolvePaletteHue({ palette: "auto", lat: -33, date: d("2026-07-15T12:00") }), PALETTE_HUES.winter);
});

test("auto palette falls back to the date's season when latitude is unknown", () => {
  // Unknown latitude → treated as northern hemisphere.
  assert.equal(resolvePaletteSeason({ palette: "auto", lat: null, date: d("2026-12-20T12:00") }), "winter");
});

test("daypartFromHour buckets day / evening / night", () => {
  assert.equal(daypartFromHour(9), "day");
  assert.equal(daypartFromHour(13), "day");
  assert.equal(daypartFromHour(18), "evening");
  assert.equal(daypartFromHour(23), "night");
  assert.equal(daypartFromHour(3), "night");
  assert.equal(daypartFromHour("nope"), "day"); // safe fallback
});
