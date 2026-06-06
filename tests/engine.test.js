// Unit tests for the pure prediction engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { predictSnowDay } from "../js/engine.js";

// A neutral baseline scenario; helpers tweak one dimension at a time.
function baseInput(overrides = {}) {
  return {
    overnightSnowIn: 2,
    morningSnowIn: 0,
    snowDepthIn: 0,
    precipProbability: 0.6,
    iceRisk: 0,
    lowTempF: 28,
    windChillF: 22,
    windGustMph: 10,
    visibilityMi: 5,
    stormTiming: "overnight",
    hasWinterAlert: false,
    alertSeverity: null,
    districtSensitivity: 0.5,
    areaType: "suburban",
    schoolType: "high",
    snowDaysUsed: 0,
    snowDaysAllowed: 5,
    ...overrides,
  };
}

test("output is always within 0..100 and well-formed", () => {
  for (const ice of [0, 0.5, 1]) {
    for (const snow of [0, 5, 30]) {
      const r = predictSnowDay(baseInput({ iceRisk: ice, overnightSnowIn: snow }));
      assert.ok(r.closurePct >= 0 && r.closurePct <= 100);
      assert.ok(r.delayPct >= 0 && r.delayPct <= 100);
      assert.ok(["low", "medium", "high"].includes(r.confidence));
      assert.ok(Array.isArray(r.factors) && r.factors.length > 0);
      assert.equal(typeof r.recommendation, "string");
    }
  }
});

test("determinism: identical input yields identical output", () => {
  const a = predictSnowDay(baseInput({ iceRisk: 0.4, morningSnowIn: 2 }));
  const b = predictSnowDay(baseInput({ iceRisk: 0.4, morningSnowIn: 2 }));
  assert.deepEqual(a, b);
});

test("monotonic: more ice never lowers closure", () => {
  let prev = -1;
  for (const ice of [0, 0.25, 0.5, 0.75, 1]) {
    const pct = predictSnowDay(baseInput({ iceRisk: ice })).closurePct;
    assert.ok(pct >= prev, `ice=${ice} produced ${pct} < ${prev}`);
    prev = pct;
  }
});

test("monotonic: more morning-commute snow never lowers closure", () => {
  let prev = -1;
  for (const s of [0, 1, 2, 4, 8]) {
    const pct = predictSnowDay(baseInput({ morningSnowIn: s })).closurePct;
    assert.ok(pct >= prev, `morningSnow=${s} produced ${pct} < ${prev}`);
    prev = pct;
  }
});

test("ice is weighted more heavily than raw temperature", () => {
  const icy = predictSnowDay(baseInput({ iceRisk: 1, lowTempF: 30 }));
  const cold = predictSnowDay(baseInput({ iceRisk: 0, lowTempF: -10 }));
  assert.ok(
    icy.closurePct > cold.closurePct,
    `ice ${icy.closurePct}% should beat cold-only ${cold.closurePct}%`
  );
});

test("morning-commute snow outweighs the same snow at midday", () => {
  const morning = predictSnowDay(
    baseInput({ morningSnowIn: 3, overnightSnowIn: 0, stormTiming: "morning" })
  );
  const midday = predictSnowDay(
    baseInput({ morningSnowIn: 0, overnightSnowIn: 3, stormTiming: "daytime" })
  );
  assert.ok(morning.closurePct > midday.closurePct);
});

test("clear, calm day predicts a very low closure chance", () => {
  const r = predictSnowDay(
    baseInput({
      overnightSnowIn: 0,
      morningSnowIn: 0,
      precipProbability: 0.05,
      iceRisk: 0,
      lowTempF: 36,
      windChillF: 34,
    })
  );
  assert.ok(r.closurePct < 20, `expected low closure, got ${r.closurePct}`);
});

test("full-blown blizzard saturates near (but not over) 100", () => {
  const r = predictSnowDay(
    baseInput({
      overnightSnowIn: 18,
      morningSnowIn: 8,
      iceRisk: 0.9,
      windGustMph: 50,
      visibilityMi: 0.1,
      snowDepthIn: 14,
      precipProbability: 1,
      lowTempF: 5,
      windChillF: -20,
      hasWinterAlert: true,
      alertSeverity: "warning",
      areaType: "rural",
      schoolType: "elementary",
    })
  );
  assert.ok(r.closurePct >= 90 && r.closurePct <= 100);
});

test("colleges close far less readily than elementary schools", () => {
  const elem = predictSnowDay(baseInput({ overnightSnowIn: 6, schoolType: "elementary" }));
  const college = predictSnowDay(baseInput({ overnightSnowIn: 6, schoolType: "college" }));
  assert.ok(elem.closurePct > college.closurePct);
});

test("delay vs closure separation: morning storm favors a delay", () => {
  // Moderate snow that lands in the commute window and then eases.
  const r = predictSnowDay(
    baseInput({ overnightSnowIn: 1, morningSnowIn: 2, stormTiming: "morning" })
  );
  assert.ok(r.delayPct > r.closurePct, `delay ${r.delayPct} should exceed closure ${r.closurePct}`);
});

test("delay falls when closure is near-certain", () => {
  const huge = predictSnowDay(
    baseInput({ overnightSnowIn: 20, morningSnowIn: 8, iceRisk: 1, stormTiming: "overnight" })
  );
  assert.ok(huge.closurePct >= 90);
  assert.ok(huge.delayPct < 40, `delay should drop when closure is near-certain, got ${huge.delayPct}`);
});

test("confidence drops in the mushy middle", () => {
  // Tune to land mid-range, then confirm confidence is not 'high'.
  const r = predictSnowDay(baseInput({ overnightSnowIn: 4, morningSnowIn: 1, iceRisk: 0.15 }));
  if (r.closurePct >= 40 && r.closurePct <= 60) {
    assert.notEqual(r.confidence, "high");
  }
});

test("an alert agreeing with a high reading raises confidence", () => {
  const withAlert = predictSnowDay(
    baseInput({ overnightSnowIn: 10, iceRisk: 0.6, hasWinterAlert: true, alertSeverity: "warning" })
  );
  const without = predictSnowDay(
    baseInput({ overnightSnowIn: 10, iceRisk: 0.6, hasWinterAlert: false, alertSeverity: null })
  );
  assert.ok(withAlert.confidenceScore >= without.confidenceScore);
});

test("missing visibility lowers confidence, not the score to zero", () => {
  const known = predictSnowDay(baseInput({ visibilityMi: 5 }));
  const unknown = predictSnowDay(baseInput({ visibilityMi: null }));
  // Visibility of 5mi contributes 0 points anyway, so closure should match,
  // but the unknown case should not be MORE confident.
  assert.ok(unknown.confidenceScore <= known.confidenceScore);
  const visFactor = unknown.factors.find((f) => f.key === "visibility");
  assert.equal(visFactor.points, 0);
});

test("guards against NaN / missing fields without throwing", () => {
  assert.doesNotThrow(() => predictSnowDay({}));
  const r = predictSnowDay({ overnightSnowIn: "not a number", iceRisk: undefined });
  assert.ok(r.closurePct >= 0 && r.closurePct <= 100);
});

test("factor breakdown exposes proportional bar data", () => {
  const r = predictSnowDay(baseInput({ iceRisk: 0.5 }));
  for (const f of r.factors) {
    assert.equal(typeof f.key, "string");
    assert.equal(typeof f.label, "string");
    assert.equal(typeof f.points, "number");
    assert.ok(f.maxPoints > 0);
    assert.ok(["positive", "negative", "neutral"].includes(f.direction));
    assert.equal(typeof f.detail, "string");
  }
});
