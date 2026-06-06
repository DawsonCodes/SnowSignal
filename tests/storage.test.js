// Tests for the localStorage wrapper. We install a tiny in-memory localStorage
// stub before importing the module (storage.js reads it lazily, not at import).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  getSettings,
  saveSettings,
  addRecentSearch,
  getRecentSearches,
  saveLocation,
  getSavedLocations,
  removeLocation,
  getCachedForecast,
  setCachedForecast,
  DEFAULT_SETTINGS,
} = await import("../js/storage.js");

beforeEach(() => store.clear());

test("settings return defaults and merge partial saves", () => {
  assert.deepEqual(getSettings(), DEFAULT_SETTINGS);
  saveSettings({ theme: "midnight" });
  assert.equal(getSettings().theme, "midnight");
  assert.equal(getSettings().tempUnit, DEFAULT_SETTINGS.tempUnit); // untouched
});

test("recent searches are MRU, de-duplicated, and capped at 8", () => {
  for (let i = 0; i < 10; i++) {
    addRecentSearch({ query: `q${i}`, name: `City ${i}`, lat: i, lon: i });
  }
  const recents = getRecentSearches();
  assert.equal(recents.length, 8);
  assert.equal(recents[0].name, "City 9"); // most recent first

  // Re-adding an existing coordinate moves it to the front without duplicating.
  addRecentSearch({ query: "again", name: "City 5", lat: 5, lon: 5 });
  const after = getRecentSearches();
  assert.equal(after[0].name, "City 5");
  assert.equal(after.filter((r) => r.name === "City 5").length, 1);
});

test("saved locations de-duplicate by rounded coordinate and can be removed", () => {
  saveLocation({ label: "A", lat: 42.795, lon: -84.351 });
  saveLocation({ label: "A again", lat: 42.795, lon: -84.351 });
  assert.equal(getSavedLocations().length, 1);
  const id = getSavedLocations()[0].id;
  removeLocation(id);
  assert.equal(getSavedLocations().length, 0);
});

test("forecast cache honors its TTL", () => {
  const lat = 42.79;
  const lon = -84.35;
  setCachedForecast(lat, lon, { hello: "world" }, 1000);
  const fresh = getCachedForecast(lat, lon, Date.now());
  assert.ok(fresh && fresh.payload.hello === "world");

  // Far in the future → expired → null.
  const stale = getCachedForecast(lat, lon, Date.now() + 5000);
  assert.equal(stale, null);
});

test("bad JSON in storage does not throw", () => {
  store.set("snowday:v1", "{not valid json");
  assert.doesNotThrow(() => getSettings());
});
