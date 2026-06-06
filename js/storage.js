// storage.js
// Thin, defensive wrapper around localStorage. Everything lives under one
// versioned root key so it is easy to inspect and clear. All access is wrapped
// in try/catch — in private mode or when storage is full/disabled the app keeps
// working with an in-memory fallback (no persistence, but no crashes).

const ROOT_KEY = "snowday:v1";
const RECENTS_CAP = 8;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const DEFAULT_SETTINGS = {
  theme: "system", // 'system' | 'light' | 'dark'
  seasonalPalette: "auto", // 'auto' | 'winter' | 'spring' | 'summer' | 'fall' | 'custom'
  accentHue: null, // null = brand default; otherwise an integer hue 0..360 (used when Custom)
  atmosphere: "auto", // 'auto' | 'winter' | 'spring' | 'summer' | 'fall' | 'off'
  tempUnit: "fahrenheit",
  reducedMotion: "system", // 'system' | 'on' | 'off'
  schoolType: "high",
  areaType: "suburban",
  districtSensitivity: 0.5,
  snowDaysUsed: 0,
  snowDaysAllowed: 5,
};

// Themes retired in v1.0.0-beta.3. Any persisted value here migrates to the
// closest surviving theme so beta.2 preferences keep working.
const LEGACY_THEME_MAP = {
  midnight: "dark",
  "midnight-snow": "dark",
  frost: "dark",
  slate: "dark",
};

// Which settings count as "school" vs "appearance/preferences", so the two reset
// actions in the Settings dialog can target the right subset.
export const SCHOOL_SETTING_KEYS = [
  "schoolType",
  "areaType",
  "districtSensitivity",
  "snowDaysUsed",
  "snowDaysAllowed",
];

let memoryFallback = null; // used when localStorage is unavailable

function readRoot() {
  if (memoryFallback) return memoryFallback;
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return memoryFallback || {};
  }
}

function writeRoot(data) {
  try {
    localStorage.setItem(ROOT_KEY, JSON.stringify(data));
  } catch {
    memoryFallback = data; // degrade to in-memory for this session
  }
}

// --- settings ------------------------------------------------------------

export function getSettings() {
  const root = readRoot();
  const merged = { ...DEFAULT_SETTINGS, ...(root.settings || {}) };
  // Migrate any retired theme preference to a surviving theme, persisting once.
  if (Object.prototype.hasOwnProperty.call(LEGACY_THEME_MAP, merged.theme)) {
    merged.theme = LEGACY_THEME_MAP[merged.theme];
    root.settings = merged;
    writeRoot(root);
  }
  return merged;
}

export function saveSettings(partial) {
  const root = readRoot();
  root.settings = { ...DEFAULT_SETTINGS, ...(root.settings || {}), ...partial };
  writeRoot(root);
  return root.settings;
}

/** Reset only the school-context settings to their defaults; keep appearance prefs. */
export function resetSchoolSettings() {
  const root = readRoot();
  const current = { ...DEFAULT_SETTINGS, ...(root.settings || {}) };
  for (const key of SCHOOL_SETTING_KEYS) current[key] = DEFAULT_SETTINGS[key];
  root.settings = current;
  writeRoot(root);
  return root.settings;
}

/** Reset every saved preference (appearance + school) back to defaults. */
export function resetPreferences() {
  const root = readRoot();
  root.settings = { ...DEFAULT_SETTINGS };
  writeRoot(root);
  return root.settings;
}

// --- saved (favorite) locations ------------------------------------------

export function getSavedLocations() {
  return readRoot().savedLocations || [];
}

export function saveLocation(loc) {
  const root = readRoot();
  const list = root.savedLocations || [];
  const id = `${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
  if (!list.some((l) => l.id === id)) {
    list.push({ id, ...loc });
    root.savedLocations = list;
    writeRoot(root);
  }
  return root.savedLocations || list;
}

export function removeLocation(id) {
  const root = readRoot();
  root.savedLocations = (root.savedLocations || []).filter((l) => l.id !== id);
  writeRoot(root);
  return root.savedLocations;
}

export function clearSavedLocations() {
  const root = readRoot();
  root.savedLocations = [];
  writeRoot(root);
  return root.savedLocations;
}

// --- recent searches (most-recent-first, capped, de-duplicated) ----------

export function getRecentSearches() {
  return readRoot().recentSearches || [];
}

export function addRecentSearch(entry) {
  const root = readRoot();
  const list = root.recentSearches || [];
  const key = `${entry.lat.toFixed(2)},${entry.lon.toFixed(2)}`;
  const deduped = list.filter((e) => `${e.lat.toFixed(2)},${e.lon.toFixed(2)}` !== key);
  deduped.unshift({ ...entry, ts: Date.now() });
  root.recentSearches = deduped.slice(0, RECENTS_CAP);
  writeRoot(root);
  return root.recentSearches;
}

export function clearRecentSearches() {
  const root = readRoot();
  root.recentSearches = [];
  writeRoot(root);
  return root.recentSearches;
}

// --- local estimate counter (device-local; never sent anywhere) ----------

export function getEstimateCount() {
  const n = readRoot().estimateCount;
  return Number.isFinite(n) ? n : 0;
}

export function incrementEstimateCount() {
  const root = readRoot();
  const current = Number.isFinite(root.estimateCount) ? root.estimateCount : 0;
  root.estimateCount = current + 1;
  writeRoot(root);
  return root.estimateCount;
}

export function resetEstimateCount() {
  const root = readRoot();
  root.estimateCount = 0;
  writeRoot(root);
  return 0;
}

// --- forecast cache (keyed by rounded lat/lon, with TTL) -----------------

const cacheKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export function getCachedForecast(lat, lon, now = Date.now()) {
  const cache = readRoot().forecastCache || {};
  const hit = cache[cacheKey(lat, lon)];
  if (!hit) return null;
  if (now - hit.fetchedAt > (hit.ttlMs || DEFAULT_TTL_MS)) return null;
  return { payload: hit.payload, fetchedAt: hit.fetchedAt };
}

export function setCachedForecast(lat, lon, payload, ttlMs = DEFAULT_TTL_MS) {
  const root = readRoot();
  root.forecastCache = root.forecastCache || {};
  root.forecastCache[cacheKey(lat, lon)] = { fetchedAt: Date.now(), ttlMs, payload };
  // Keep the cache small — drop all but the 8 most recent entries.
  const entries = Object.entries(root.forecastCache).sort(
    (a, b) => b[1].fetchedAt - a[1].fetchedAt
  );
  root.forecastCache = Object.fromEntries(entries.slice(0, 8));
  writeRoot(root);
}
