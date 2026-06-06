// engine.js
// PURE, deterministic snow-day prediction engine.
//
// This file imports nothing and touches no DOM, network, clock, or randomness.
// Everything it needs is passed in as a plain `SnowDayInput` object, so the exact
// same file runs unchanged in the browser AND under `node --test`.
//
// The model is a transparent, additive weighted score — NOT random, and NOT based
// on fabricated historical closure data. Ice risk and snowfall during the morning
// commute are deliberately the two heaviest factors. The numbers below are tunable
// weights, documented inline; adjust them and the behavior changes predictably.

import { clamp } from "./format.js";

// Closure maps linearly from raw points to a percentage, then caps at 99 (we never
// claim a guaranteed 100%). CLOSURE_SCALE is chosen so a strong storm (~raw 80) tops
// out and a clear day (~raw 0) sits near 0.
const CLOSURE_SCALE = 1.2;
const CLOSURE_MAX = 99;

// Delay uses a saturating curve: percent = 100 * raw / (raw + DELAY_K).
const DELAY_K = 45;

/**
 * @typedef {Object} SnowDayInput
 * @property {number} overnightSnowIn   inches accumulating ~6pm–6am
 * @property {number} morningSnowIn     inches accumulating ~5am–9am (commute window)
 * @property {number} snowDepthIn       existing snow already on the ground
 * @property {number} precipProbability 0..1 max precip probability over the window
 * @property {number} iceRisk           0..1 freezing-rain / mix severity
 * @property {number} lowTempF          overnight low (°F)
 * @property {number} windChillF        min apparent temperature (°F)
 * @property {number} windGustMph       peak gust (mph)
 * @property {number|null} visibilityMi min visibility (miles); null = unknown
 * @property {'overnight'|'morning'|'daytime'} stormTiming
 * @property {boolean} hasWinterAlert
 * @property {'advisory'|'watch'|'warning'|null} alertSeverity
 * @property {number} districtSensitivity 0..1 (0.5 = average)
 * @property {'urban'|'suburban'|'rural'} areaType
 * @property {'elementary'|'middle'|'high'|'college'} schoolType
 * @property {number} snowDaysUsed
 * @property {number} snowDaysAllowed
 */

/** Fill in defaults and record which meaningful inputs were missing/unknown. */
function normalize(input = {}) {
  const missing = [];
  const num = (v, fallback, key) => {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) {
      if (key) missing.push(key);
      return fallback;
    }
    return Number(v);
  };

  const visibilityMi =
    input.visibilityMi === null || input.visibilityMi === undefined
      ? null
      : num(input.visibilityMi, null);
  if (visibilityMi === null) missing.push("visibility");

  return {
    overnightSnowIn: Math.max(0, num(input.overnightSnowIn, 0)),
    morningSnowIn: Math.max(0, num(input.morningSnowIn, 0)),
    snowDepthIn: Math.max(0, num(input.snowDepthIn, 0)),
    precipProbability: clamp(num(input.precipProbability, 0.5, "precipProbability"), 0, 1),
    iceRisk: clamp(num(input.iceRisk, 0), 0, 1),
    lowTempF: num(input.lowTempF, 30),
    windChillF: num(input.windChillF, num(input.lowTempF, 30)),
    windGustMph: Math.max(0, num(input.windGustMph, 0)),
    visibilityMi,
    stormTiming: ["overnight", "morning", "daytime"].includes(input.stormTiming)
      ? input.stormTiming
      : "overnight",
    hasWinterAlert: Boolean(input.hasWinterAlert),
    alertSeverity: ["advisory", "watch", "warning"].includes(input.alertSeverity)
      ? input.alertSeverity
      : null,
    districtSensitivity: clamp(num(input.districtSensitivity, 0.5), 0, 1),
    areaType: ["urban", "suburban", "rural"].includes(input.areaType)
      ? input.areaType
      : "suburban",
    schoolType: ["elementary", "middle", "high", "college"].includes(input.schoolType)
      ? input.schoolType
      : "high",
    snowDaysUsed: Math.max(0, num(input.snowDaysUsed, 0)),
    snowDaysAllowed: Math.max(0, num(input.snowDaysAllowed, 5)),
    _missing: missing,
  };
}

const alertWeight = (severity) =>
  severity === "warning" ? 1 : severity === "watch" ? 0.6 : severity === "advisory" ? 0.45 : 0;

// "Is there actually a storm?" 0..1. Storm timing only matters when snow/ice exists —
// otherwise a clear day would score timing points just for defaulting to "overnight".
const stormPresence = (x) =>
  clamp((x.overnightSnowIn + x.morningSnowIn + x.iceRisk * 4) / 3, 0, 1);

/**
 * Build the list of named closure factors. Each entry carries the points it
 * contributed, the max it could contribute (for proportional bars in the UI),
 * a direction, and a plain-English detail line.
 */
function closureFactors(x) {
  const f = [];
  const add = (key, label, points, maxPoints, detail) => {
    const direction = points > 0.5 ? "positive" : points < -0.5 ? "negative" : "neutral";
    f.push({ key, label, points: Math.round(points * 10) / 10, maxPoints, direction, detail });
  };

  // Ice risk — heaviest single lever (freezing rain closes schools on its own).
  const icePts = 30 * x.iceRisk;
  add(
    "ice",
    "Freezing rain / ice risk",
    icePts,
    30,
    x.iceRisk >= 0.66
      ? "Significant ice — roads likely untreatable"
      : x.iceRisk >= 0.33
      ? "Some wintry mix / slick spots possible"
      : "Mostly snow, little ice expected"
  );

  // Snow during the morning commute — the decisive operational window.
  const morningPts = 25 * Math.min(1, x.morningSnowIn / 4);
  add(
    "morningCommute",
    "Snow during the morning commute",
    morningPts,
    25,
    x.morningSnowIn >= 1
      ? `~${round1(x.morningSnowIn)}" falling around bus time`
      : "Little to no snow during the commute"
  );

  // Overnight accumulation.
  const overnightPts = 20 * Math.min(1, x.overnightSnowIn / 8);
  add(
    "overnightSnow",
    "Overnight snow accumulation",
    overnightPts,
    20,
    `~${round1(x.overnightSnowIn)}" expected overnight`
  );

  // Storm timing (only counts when a storm is actually present).
  const timingBase = x.stormTiming === "overnight" ? 12 : x.stormTiming === "morning" ? 9 : 2;
  const timingPts = timingBase * stormPresence(x);
  add(
    "timing",
    "Storm timing",
    timingPts,
    12,
    x.stormTiming === "overnight"
      ? "Heaviest snow overnight, before buses roll"
      : x.stormTiming === "morning"
      ? "Still coming down around commute time"
      : "Worst of it lands during the school day or later"
  );

  // Official winter alert.
  const alertPts = 12 * alertWeight(x.alertSeverity);
  add(
    "alert",
    "Official winter alert",
    alertPts,
    12,
    x.alertSeverity
      ? `NWS ${capitalize(x.alertSeverity)} in effect`
      : "No active winter alert"
  );

  // Wind chill (dangerous bus-stop waits).
  const chillPts = 8 * clamp((10 - x.windChillF) / 25, 0, 1);
  add(
    "windChill",
    "Wind chill",
    chillPts,
    8,
    x.windChillF <= -5
      ? `Dangerous wind chill near ${Math.round(x.windChillF)}°F`
      : `Wind chill around ${Math.round(x.windChillF)}°F`
  );

  // Wind gusts (blowing/drifting snow, whiteouts).
  const gustPts = 6 * clamp((x.windGustMph - 15) / 25, 0, 1);
  add(
    "gusts",
    "Wind gusts",
    gustPts,
    6,
    x.windGustMph >= 35
      ? `Strong gusts to ${Math.round(x.windGustMph)} mph (blowing snow)`
      : `Gusts around ${Math.round(x.windGustMph)} mph`
  );

  // Low visibility.
  const visPts =
    x.visibilityMi === null ? 0 : 6 * clamp((2 - x.visibilityMi) / 1.75, 0, 1);
  add(
    "visibility",
    "Low visibility",
    visPts,
    6,
    x.visibilityMi === null
      ? "Visibility data unavailable"
      : x.visibilityMi <= 0.25
      ? "Near-whiteout visibility"
      : `Visibility around ${round1(x.visibilityMi)} mi`
  );

  // Existing snow depth (plowing backlog).
  const depthPts = 5 * Math.min(1, x.snowDepthIn / 12);
  add(
    "snowDepth",
    "Existing snow on the ground",
    depthPts,
    5,
    `~${round1(x.snowDepthIn)}" already on the ground`
  );

  // Precipitation probability.
  const probPts = 5 * x.precipProbability;
  add(
    "precipProbability",
    "Precipitation probability",
    probPts,
    5,
    `${Math.round(x.precipProbability * 100)}% chance of precipitation`
  );

  // Raw overnight low temperature (will snow stick / refreeze).
  const tempPts = 5 * clamp((34 - x.lowTempF) / 19, 0, 1);
  add(
    "temperature",
    "Overnight low temperature",
    tempPts,
    5,
    `Low around ${Math.round(x.lowTempF)}°F`
  );

  // --- Context modifiers (can push either direction) ---------------------
  const areaPts = x.areaType === "rural" ? 8 : x.areaType === "urban" ? -6 : 0;
  add(
    "areaType",
    "Area type",
    areaPts,
    8,
    x.areaType === "rural"
      ? "Rural back roads are slower to clear"
      : x.areaType === "urban"
      ? "Urban roads get plowed quickly"
      : "Suburban road network"
  );

  const schoolPts =
    x.schoolType === "elementary"
      ? 6
      : x.schoolType === "middle"
      ? 2
      : x.schoolType === "college"
      ? -10
      : 0;
  add(
    "schoolType",
    "School type",
    schoolPts,
    10,
    x.schoolType === "college"
      ? "Colleges rarely close for snow"
      : x.schoolType === "elementary"
      ? "Younger kids → more cautious admin"
      : `${capitalize(x.schoolType)} school`
  );

  const sensPts = (x.districtSensitivity - 0.5) * 20;
  add(
    "districtSensitivity",
    "District snow-day tendency",
    sensPts,
    10,
    x.districtSensitivity >= 0.66
      ? "District closes readily"
      : x.districtSensitivity <= 0.34
      ? "District rarely closes"
      : "Average district tendency"
  );

  const overBudget = x.snowDaysUsed - x.snowDaysAllowed;
  const budgetPts = overBudget > 0 ? -Math.min(12, overBudget * 4) : 0;
  add(
    "snowDaysUsed",
    "Snow days already used",
    budgetPts,
    12,
    overBudget > 0
      ? `${x.snowDaysUsed}/${x.snowDaysAllowed} used — district reluctant to add more`
      : `${x.snowDaysUsed}/${x.snowDaysAllowed} snow days used`
  );

  return f;
}

/** Delay uses the same inputs but a profile tuned for "2-hour delay" scenarios. */
function rawDelayScore(x) {
  let s = 0;
  s += 25 * Math.min(1, x.morningSnowIn / 3); // morning snow dominates delays
  s += 22 * x.iceRisk; // morning ice → delay to let crews treat roads
  // Timing matters inversely vs closure: a storm that hits/clears in the morning
  // is the textbook delay; an overnight storm that ends early still needs cleanup.
  // Gated by storm presence so a clear day scores no timing points.
  const timingBase = x.stormTiming === "morning" ? 12 : x.stormTiming === "overnight" ? 7 : 3;
  s += timingBase * stormPresence(x);
  s += 10 * Math.min(1, x.overnightSnowIn / 6);
  s += 8 * alertWeight(x.alertSeverity);
  s += 6 * clamp((10 - x.windChillF) / 25, 0, 1);
  s += 4 * clamp((x.windGustMph - 15) / 25, 0, 1);
  s += x.visibilityMi === null ? 0 : 5 * clamp((2 - x.visibilityMi) / 1.75, 0, 1);
  s += 3 * Math.min(1, x.snowDepthIn / 12);
  s += 4 * x.precipProbability;
  s += 3 * clamp((34 - x.lowTempF) / 19, 0, 1);
  // Lighter context modifiers.
  s += x.areaType === "rural" ? 5 : x.areaType === "urban" ? -4 : 0;
  s += x.schoolType === "elementary" ? 4 : x.schoolType === "college" ? -6 : 0;
  s += (x.districtSensitivity - 0.5) * 12;
  return Math.max(0, s);
}

function saturate(raw, k) {
  const r = Math.max(0, raw);
  return clamp(Math.round((100 * r) / (r + k)), 0, 100);
}

/** Confidence = how clear-cut the inputs are (NOT an accuracy guarantee). */
function computeConfidence(x, closurePct) {
  let c = 0.5;

  // Official alert agreeing with a high model reading → more clear-cut.
  if (x.hasWinterAlert && closurePct >= 50) c += 0.15;
  // No alert and a low reading also agree.
  if (!x.hasWinterAlert && closurePct < 30) c += 0.1;
  // Alert present but model says "open" → conflicting signals.
  if (x.hasWinterAlert && closurePct < 30) c -= 0.1;

  // High precip probability = less ambiguous setup.
  c += (x.precipProbability - 0.5) * 0.2;

  // Extreme, unambiguous conditions.
  if (x.iceRisk >= 0.66 || x.overnightSnowIn >= 10) c += 0.1;

  // The mushy middle is inherently uncertain.
  if (closurePct >= 40 && closurePct <= 60) c -= 0.2;

  // Missing key inputs reduce confidence.
  if (x._missing.length > 0) c -= 0.1;

  const score = clamp(c, 0.05, 0.95);
  const label = score < 0.4 ? "low" : score < 0.7 ? "medium" : "high";
  return { confidence: label, confidenceScore: Math.round(score * 100) / 100 };
}

function buildRecommendation(closurePct, delayPct, confidence) {
  let base;
  if (closurePct >= 70) {
    base = "A full snow day looks likely.";
  } else if (closurePct >= 45) {
    base = "A closure is a real possibility — watch for official word tonight.";
  } else if (closurePct >= 25) {
    base = "School will probably open, though a delay is on the table.";
  } else {
    base = "School will most likely be open and on time.";
  }

  let delayNote = "";
  if (closurePct < 70 && delayPct >= 50) {
    delayNote = " A 2-hour delay is the most likely middle ground.";
  } else if (closurePct < 45 && delayPct >= 35) {
    delayNote = " Keep an eye out for a possible delay.";
  }

  const confNote =
    confidence === "low"
      ? " Confidence is low — the forecast is borderline, so check official sources."
      : confidence === "high"
      ? " The signals are fairly clear-cut."
      : "";

  return base + delayNote + confNote;
}

/**
 * Run the prediction.
 * @param {SnowDayInput} input
 * @returns {{closurePct:number, delayPct:number, confidence:'low'|'medium'|'high',
 *   confidenceScore:number, recommendation:string, factors:Array}}
 */
export function predictSnowDay(input) {
  const x = normalize(input);
  const factors = closureFactors(x);

  const rawClosure = factors.reduce((sum, f) => sum + f.points, 0);
  const closurePct = clamp(Math.round(rawClosure * CLOSURE_SCALE), 0, CLOSURE_MAX);

  const rawDelay = rawDelayScore(x);
  // Couple delay to closure: once a closure becomes likely (>40%), a delay grows less
  // likely (they would simply close instead). Below 40% closure there is no suppression,
  // so genuinely marginal storms can favor a delay over a full closure.
  const suppression = 1 - Math.max(0, (closurePct - 40) / 60) * 0.8;
  const delayPct = clamp(Math.round(saturate(rawDelay, DELAY_K) * suppression), 0, 100);

  const { confidence, confidenceScore } = computeConfidence(x, closurePct);
  const recommendation = buildRecommendation(closurePct, delayPct, confidence);

  return { closurePct, delayPct, confidence, confidenceScore, recommendation, factors };
}

// --- tiny local helpers --------------------------------------------------
function round1(n) {
  return Math.round(n * 10) / 10;
}
function capitalize(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}
