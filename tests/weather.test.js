// Tests for the Open-Meteo -> engine-input mapping and the NWS alert summarizer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapForecastToEngineInput, buildHourlyTimeline } from "../js/weather.js";
import { summarizeWinterAlerts, EMPTY_ALERTS } from "../js/alerts.js";
import { predictSnowDay } from "../js/engine.js";

const load = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

const snowstorm = load("openmeteo-snowstorm.json");
const icestorm = load("openmeteo-icestorm.json");
const clear = load("openmeteo-clear.json");
const nwsAlert = load("nws-alert-winter.json");

// A fixed clock on the evening of 2026-01-09, so the target morning is 2026-01-10.
const EVENING = new Date("2026-01-09T20:00:00");

test("snowstorm fixture: snow buckets into overnight + morning windows", () => {
  const input = mapForecastToEngineInput(snowstorm, { now: EVENING });
  assert.ok(input.overnightSnowIn > 3, `overnight snow ${input.overnightSnowIn}`);
  assert.ok(input.morningSnowIn > 3, `morning snow ${input.morningSnowIn}`);
  assert.equal(input.stormTiming, "overnight"); // heaviest precip is overnight
});

test("snowstorm fixture: units converted (snow inch, visibility miles, depth inch)", () => {
  const input = mapForecastToEngineInput(snowstorm, { now: EVENING });
  // visibility 400m -> ~0.25mi (well under a mile)
  assert.ok(input.visibilityMi !== null && input.visibilityMi < 1);
  // snow_depth 0.15m -> ~5.9in
  assert.ok(input.snowDepthIn > 4 && input.snowDepthIn < 8);
  // gusts read straight through (mph)
  assert.ok(input.windGustMph >= 30);
  // low temp stays in Fahrenheit range
  assert.ok(input.lowTempF < 20);
});

test("snowstorm maps to a high closure probability end-to-end", () => {
  const input = mapForecastToEngineInput(snowstorm, {
    now: EVENING,
    schoolContext: { schoolType: "elementary", areaType: "rural" },
  });
  const result = predictSnowDay(input);
  assert.ok(result.closurePct >= 70, `closure ${result.closurePct}`);
});

test("icestorm fixture: ice risk detected and timing is morning", () => {
  const input = mapForecastToEngineInput(icestorm, { now: EVENING });
  assert.ok(input.iceRisk >= 0.8, `ice risk ${input.iceRisk}`); // weathercode 66
  assert.equal(input.stormTiming, "morning");
  assert.ok(input.morningSnowIn < 0.1); // freezing rain, not snow
});

test("clear fixture: near-zero closure", () => {
  const input = mapForecastToEngineInput(clear, { now: EVENING });
  const result = predictSnowDay(input);
  assert.ok(result.closurePct < 15, `closure ${result.closurePct}`);
});

test("missing visibility maps to null (not zero)", () => {
  const noVis = JSON.parse(JSON.stringify(clear));
  noVis.hourly.visibility = noVis.hourly.visibility.map(() => null);
  const input = mapForecastToEngineInput(noVis, { now: EVENING });
  assert.equal(input.visibilityMi, null);
});

test("timezone/date mismatch falls back to first morning without throwing", () => {
  // A 'now' far outside the fixture's date range.
  const input = mapForecastToEngineInput(snowstorm, { now: new Date("2030-03-03T20:00:00") });
  assert.ok(Number.isFinite(input.overnightSnowIn));
  assert.ok(Number.isFinite(input.morningSnowIn));
});

test("determinism: same forecast + same now => identical mapping", () => {
  const a = mapForecastToEngineInput(snowstorm, { now: EVENING });
  const b = mapForecastToEngineInput(snowstorm, { now: EVENING });
  assert.deepEqual(a, b);
});

test("hourly timeline returns capped, well-formed entries", () => {
  const timeline = buildHourlyTimeline(snowstorm, { now: EVENING, hours: 12 });
  assert.ok(timeline.length > 0 && timeline.length <= 12);
  for (const h of timeline) {
    assert.equal(typeof h.time, "string");
    assert.ok(h.tempF === null || Number.isFinite(h.tempF));
    assert.ok(Number.isFinite(h.snowIn));
  }
});

test("summarizeWinterAlerts picks the most severe winter event, filters non-winter", () => {
  const summary = summarizeWinterAlerts(nwsAlert);
  assert.equal(summary.hasWinterAlert, true);
  assert.equal(summary.alertSeverity, "warning"); // Winter Storm Warning
  assert.match(summary.headline, /Winter Storm Warning/);
});

test("summarizeWinterAlerts returns EMPTY for no winter alerts", () => {
  assert.deepEqual(summarizeWinterAlerts({ features: [] }), EMPTY_ALERTS);
  assert.deepEqual(summarizeWinterAlerts(null), EMPTY_ALERTS);
});
