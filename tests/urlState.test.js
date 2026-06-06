// Tests for clean URL behavior: the share-link builder omits defaults and only
// includes scenario-defining fields. buildShareParams is pure (no DOM).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareParams, SHARE_DEFAULTS } from "../js/urlState.js";

const parse = (qs) => new URLSearchParams(qs);

test("an all-defaults scenario with no location produces an empty query", () => {
  const qs = buildShareParams({ ...SHARE_DEFAULTS });
  assert.equal(qs, "");
});

test("default-valued context fields are omitted from the share URL", () => {
  const qs = buildShareParams({
    loc: "Owosso",
    lat: 42.9978,
    lon: -84.1764,
    school: "high", // default → omitted
    area: "suburban", // default → omitted
    sens: 0.5, // default → omitted
    used: 0, // default → omitted
    allowed: 5, // default → omitted
    unit: "fahrenheit", // default → omitted
  });
  const p = parse(qs);
  assert.equal(p.get("loc"), "Owosso");
  assert.ok(p.has("lat") && p.has("lon"));
  for (const k of ["school", "area", "sens", "used", "allowed", "unit"]) {
    assert.equal(p.has(k), false, `${k} should be omitted when default`);
  }
});

test("non-default context fields are included", () => {
  const qs = buildShareParams({
    lat: 40,
    lon: -83,
    school: "elementary",
    area: "rural",
    sens: 0.8,
    used: 3,
    allowed: 4,
    unit: "celsius",
  });
  const p = parse(qs);
  assert.equal(p.get("school"), "elementary");
  assert.equal(p.get("area"), "rural");
  assert.equal(p.get("sens"), "0.8");
  assert.equal(p.get("used"), "3");
  assert.equal(p.get("allowed"), "4");
  assert.equal(p.get("unit"), "celsius");
});

test("coordinates are rounded to keep the URL short", () => {
  const qs = buildShareParams({ lat: 42.99781234, lon: -84.17649876 });
  const p = parse(qs);
  assert.equal(p.get("lat"), "42.9978");
  assert.equal(p.get("lon"), "-84.1765");
});

test("used snow days exceeding the allowance round-trips through the URL", () => {
  const qs = buildShareParams({ lat: 1, lon: 2, used: 9, allowed: 6 });
  const p = parse(qs);
  assert.equal(p.get("used"), "9");
  assert.equal(p.get("allowed"), "6");
});
