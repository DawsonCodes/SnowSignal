// Tests for the reverse-geocode payload parser and its graceful fallbacks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReverseGeocode } from "../js/geocode.js";
import { formatPlaceLabel } from "../js/format.js";

test("parses a BigDataCloud payload into a friendly place + label", () => {
  const data = {
    city: "Owosso",
    locality: "Owosso",
    principalSubdivision: "Michigan",
    countryCode: "US",
    countryName: "United States of America",
  };
  const place = parseReverseGeocode(data, 42.9978, -84.1764);
  assert.equal(place.name, "Owosso");
  assert.equal(place.admin1, "Michigan");
  assert.equal(place.country_code, "US");
  // Exact coordinates are retained for forecast accuracy.
  assert.equal(place.latitude, 42.9978);
  assert.equal(place.longitude, -84.1764);
  assert.equal(formatPlaceLabel(place), "Owosso, Michigan, US");
});

test("falls back to locality, then subdivision, when city is missing", () => {
  const a = parseReverseGeocode({ locality: "Rural Township", countryCode: "US" }, 1, 2);
  assert.equal(a.name, "Rural Township");
  const b = parseReverseGeocode({ principalSubdivision: "Ontario", countryCode: "CA" }, 1, 2);
  assert.equal(b.name, "Ontario");
});

test("returns null when there is no usable label (caller falls back to coordinates)", () => {
  assert.equal(parseReverseGeocode({}, 1, 2), null);
  assert.equal(parseReverseGeocode(null, 1, 2), null);
  assert.equal(parseReverseGeocode({ countryCode: "US" }, 1, 2), null);
});

test("does not duplicate name when subdivision equals the locality", () => {
  const place = parseReverseGeocode(
    { city: "Singapore", principalSubdivision: "Singapore", countryCode: "SG" },
    1.35,
    103.8
  );
  assert.equal(place.admin1, undefined);
  assert.equal(formatPlaceLabel(place), "Singapore, SG");
});
