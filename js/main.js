// main.js
// Thin orchestrator: wires DOM events → geocode/weather/alerts → engine → ui.
// Holds the small amount of app state; all business logic lives in the modules.

import { predictSnowDay } from "./engine.js";
import { searchPlaces, findPlace, isUnitedStates, reverseGeocode } from "./geocode.js";
import { fetchForecast, mapForecastToEngineInput, buildHourlyTimeline } from "./weather.js";
import { fetchWinterAlerts, EMPTY_ALERTS } from "./alerts.js";
import { getCurrentPosition } from "./geolocation.js";
import { formatPlaceLabel } from "./format.js";
import {
  getSettings,
  saveSettings,
  resetSchoolSettings,
  resetPreferences,
  getSavedLocations,
  saveLocation,
  removeLocation,
  clearSavedLocations,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  getCachedForecast,
  setCachedForecast,
} from "./storage.js";
import { readUrlState, buildShareUrl } from "./urlState.js";
import {
  getCalendarNotices,
  describeForecastWindow,
  forecastTargetDate,
} from "./calendarContext.js";
import { applyAtmosphere } from "./atmosphere.js";
import * as ui from "./ui.js";

const { $ } = ui;

const APP_VERSION = "1.0.0-beta.2";

// --- App state -----------------------------------------------------------
const state = {
  settings: getSettings(),
  place: null, // { name, admin1, country_code, latitude, longitude }
  forecast: null, // raw Open-Meteo payload
  alert: EMPTY_ALERTS,
  fetchedAt: null,
  fromCache: false,
  result: null,
};

let searchAbort = null;
let suggestionPlaces = [];
let activeSuggestion = -1;

// --- Settings <-> controls ----------------------------------------------

function applySettings() {
  ui.applyTheme(state.settings.theme);
  ui.applyMotion(state.settings.reducedMotion);

  // School context controls
  $("school-type").value = state.settings.schoolType;
  $("area-type").value = state.settings.areaType;
  $("sensitivity").value = String(state.settings.districtSensitivity);
  $("days-used").value = String(state.settings.snowDaysUsed);
  $("days-allowed").value = String(state.settings.snowDaysAllowed);
  updateSensitivityOutput();
  validateDays();

  // Settings dialog radios
  setRadio("theme", state.settings.theme);
  setRadio("atmosphere", state.settings.atmosphere);
  setRadio("temp-unit", state.settings.tempUnit);
  setRadio("reduced-motion", state.settings.reducedMotion);

  applyAtmosphereNow();
}

function setRadio(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function updateSensitivityOutput() {
  const v = Number($("sensitivity").value);
  const label = v >= 0.66 ? "Closes readily" : v <= 0.34 ? "Rarely closes" : "Average";
  $("sensitivity-out").textContent = label;
}

/**
 * Validate the snow-day number inputs: no negatives, capped at a sane maximum.
 * "Used" is allowed to exceed "allowed" (it happens in real districts) — we just
 * surface an explanatory note. Returns the cleaned values.
 */
function validateDays() {
  const clampInt = (id, max) => {
    const el = $(id);
    let v = Math.round(Number(el.value));
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(0, Math.min(max, v));
    el.value = String(v);
    return v;
  };
  const used = clampInt("days-used", 60);
  const allowed = clampInt("days-allowed", 60);
  const note = $("days-note");
  if (used > allowed) {
    note.textContent =
      "Used snow days exceed the district allowance. This may make the district more reluctant to close.";
    note.hidden = false;
  } else {
    note.hidden = true;
  }
  return { used, allowed };
}

function gatherSchoolContext() {
  return {
    schoolType: $("school-type").value,
    areaType: $("area-type").value,
    districtSensitivity: Number($("sensitivity").value),
    snowDaysUsed: Number($("days-used").value) || 0,
    snowDaysAllowed: Number($("days-allowed").value) || 0,
    hasWinterAlert: state.alert.hasWinterAlert,
    alertSeverity: state.alert.alertSeverity,
  };
}

function persistSchoolContext() {
  state.settings = saveSettings({
    schoolType: $("school-type").value,
    areaType: $("area-type").value,
    districtSensitivity: Number($("sensitivity").value),
    snowDaysUsed: Number($("days-used").value) || 0,
    snowDaysAllowed: Number($("days-allowed").value) || 0,
  });
}

// --- Seasonal atmosphere + calendar notices ------------------------------

function applyAtmosphereNow() {
  applyAtmosphere({
    pref: state.settings.atmosphere,
    theme: ui.resolvedTheme(),
    lat: state.place ? state.place.latitude : null,
    date: new Date(),
    motionAllowed: ui.motionAllowed(state.settings.reducedMotion),
  });
}

function refreshCalendarNotices() {
  const now = new Date();
  ui.renderCalendarNotices(
    getCalendarNotices({
      date: forecastTargetDate(now),
      lat: state.place ? state.place.latitude : null,
    })
  );
}

// --- Core: load a place and predict -------------------------------------

async function loadPlace(place) {
  state.place = place;
  ui.closeSuggestions();
  $("location").value = formatPlaceLabel(place);
  ui.showSkeleton();
  applyAtmosphereNow(); // hemisphere may flip the auto season
  refreshCalendarNotices();

  const lat = place.latitude;
  const lon = place.longitude;

  try {
    // Forecast: use a fresh fetch, fall back to cache (also enables offline).
    const cached = getCachedForecast(lat, lon);
    let forecast;
    let fromCache = false;
    let fetchedAt = Date.now();

    // Kick off alerts in parallel (US only); never blocks or throws.
    const alertsPromise = isUnitedStates(place)
      ? fetchWinterAlerts(lat, lon, { signal: timeoutSignal(4000) })
      : Promise.resolve(EMPTY_ALERTS);

    try {
      forecast = await fetchForecast(lat, lon);
      setCachedForecast(lat, lon, forecast);
    } catch (netErr) {
      if (cached) {
        forecast = cached.payload;
        fromCache = true;
        fetchedAt = cached.fetchedAt;
      } else {
        throw netErr;
      }
    }

    state.forecast = forecast;
    state.fetchedAt = fetchedAt;
    state.fromCache = fromCache;
    state.alert = await alertsPromise;

    ui.renderAlertBanner(state.alert);
    recompute();

    addRecentSearch({
      query: $("location").value,
      name: formatPlaceLabel(place),
      lat,
      lon,
    });
    refreshQuickLists();
  } catch (err) {
    ui.showError(err.message || "Something went wrong. Please try again.");
  }
}

/** Recompute the prediction from the cached forecast (e.g. after a context change). */
function recompute() {
  if (!state.forecast) return;
  const now = new Date();
  const input = mapForecastToEngineInput(state.forecast, {
    now,
    schoolContext: gatherSchoolContext(),
  });
  const result = predictSnowDay(input);
  state.result = result;

  const timeline = buildHourlyTimeline(state.forecast, { now, hours: 18 });
  ui.renderResult(result, {
    placeLabel: formatPlaceLabel(state.place),
    unit: state.settings.tempUnit,
    timeline,
    fetchedAt: state.fetchedAt,
    fromCache: state.fromCache,
    forecastWindow: describeForecastWindow(now),
    animate: ui.motionAllowed(state.settings.reducedMotion),
  });
  updateSaveButton();

  if (result.closurePct >= 85 && ui.motionAllowed(state.settings.reducedMotion)) {
    ui.launchConfetti();
  }
}

// --- Search / suggestions -----------------------------------------------

let searchTimer = null;
function onSearchInput() {
  const query = $("location").value.trim();
  if (searchTimer) clearTimeout(searchTimer);
  if (query.length < 2) {
    ui.closeSuggestions();
    return;
  }
  searchTimer = setTimeout(async () => {
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    try {
      suggestionPlaces = await searchPlaces(query, { signal: searchAbort.signal });
      activeSuggestion = -1;
      ui.renderSuggestions(suggestionPlaces, {
        onSelect: loadPlace,
        formatLabel: formatPlaceLabel,
      });
    } catch (err) {
      if (err.name !== "AbortError") ui.closeSuggestions();
    }
  }, 350);
}

function onSearchKeydown(e) {
  if ($("suggestions").hidden) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearch();
    }
    return;
  }
  const items = $("suggestions").querySelectorAll("li");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
    highlightSuggestion(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestion = Math.max(activeSuggestion - 1, 0);
    highlightSuggestion(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestion >= 0 && suggestionPlaces[activeSuggestion]) {
      loadPlace(suggestionPlaces[activeSuggestion]);
    } else {
      submitSearch();
    }
  } else if (e.key === "Escape") {
    ui.closeSuggestions();
  }
}

function highlightSuggestion(items) {
  items.forEach((li, i) => li.setAttribute("aria-selected", String(i === activeSuggestion)));
  const input = $("location");
  if (activeSuggestion >= 0) input.setAttribute("aria-activedescendant", `suggestion-${activeSuggestion}`);
}

async function submitSearch() {
  const query = $("location").value.trim();
  if (!query) return;
  ui.closeSuggestions();
  ui.showSkeleton();
  try {
    const place = await findPlace(query);
    await loadPlace(place);
  } catch (err) {
    ui.showError(err.message || "No matching location found.");
  }
}

// --- Geolocation ---------------------------------------------------------

async function useMyLocation() {
  ui.showSkeleton();
  try {
    const { lat, lon } = await getCurrentPosition();
    // Reverse-geocode to a friendly label; keep exact coords for the forecast.
    let place;
    try {
      place = await reverseGeocode(lat, lon, { signal: timeoutSignal(4000) });
    } catch {
      place = { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, latitude: lat, longitude: lon };
    }
    await loadPlace(place);
  } catch (err) {
    ui.showError(err.message || "Couldn't get your location.");
  }
}

// --- Quick lists (saved + recent) ---------------------------------------

function refreshQuickLists() {
  ui.renderSavedLocations(getSavedLocations(), {
    onSelect: (loc) => loadPlace(toPlace(loc)),
    onRemove: (id) => {
      removeLocation(id);
      refreshQuickLists();
      updateSaveButton();
    },
  });
  ui.renderRecentSearches(getRecentSearches(), {
    onSelect: (item) => loadPlace(toPlace(item)),
  });
}

const toPlace = (o) => ({
  name: o.name || o.label,
  latitude: o.lat ?? o.latitude,
  longitude: o.lon ?? o.longitude,
  admin1: o.admin1,
  country_code: o.country_code,
});

function updateSaveButton() {
  if (!state.place) return;
  const id = `${state.place.latitude.toFixed(3)},${state.place.longitude.toFixed(3)}`;
  const saved = getSavedLocations().some((l) => l.id === id);
  $("save-btn-label").textContent = saved ? "Saved" : "Save location";
}

function onSaveLocation() {
  if (!state.place) return;
  saveLocation({
    label: formatPlaceLabel(state.place),
    name: state.place.name,
    lat: state.place.latitude,
    lon: state.place.longitude,
    admin1: state.place.admin1,
    country_code: state.place.country_code,
  });
  refreshQuickLists();
  updateSaveButton();
  ui.toast("Location saved");
}

// --- Copy summary + share link ------------------------------------------

function buildSummary() {
  const r = state.result;
  const place = formatPlaceLabel(state.place);
  const lines = [
    `SnowSignal — snow day & delay estimate${place ? ` for ${place}` : ""}:`,
    `• Chance school is closed: ${r.closurePct}%`,
    `• Chance of a 2-hour delay: ${r.delayPct}%`,
    `• Confidence: ${r.confidence}`,
    `• ${r.recommendation}`,
  ];
  return `${lines.join("\n")}\n\nKnow before the bell · ${buildShareUrl(currentShareState())}`;
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    ui.toast(okMsg);
  } catch {
    ui.toast("Copy failed — select and copy manually");
  }
}

async function onCopySummary() {
  if (!state.result) return;
  await copyText(buildSummary(), "Summary copied to clipboard");
}

async function onCopyShareLink() {
  if (!state.place) return;
  await copyText(buildShareUrl(currentShareState()), "Share link copied to clipboard");
}

// --- Share-state assembly (used ONLY for explicit share actions) ---------

function currentShareState() {
  const s = {
    school: state.settings.schoolType,
    area: state.settings.areaType,
    sens: Number($("sensitivity").value),
    used: Number($("days-used").value) || 0,
    allowed: Number($("days-allowed").value) || 0,
    unit: state.settings.tempUnit,
  };
  if (state.place) {
    s.lat = state.place.latitude;
    s.lon = state.place.longitude;
    s.loc = state.place.name;
  }
  return s;
}

// --- Settings dialog -----------------------------------------------------

function wireSettings() {
  $("settings-toggle").addEventListener("click", ui.openSettings);
  $("settings-close").addEventListener("click", ui.closeSettings);
  $("settings-panel").addEventListener("click", (e) => {
    if (e.target === $("settings-panel")) ui.closeSettings();
  });

  document.querySelectorAll('input[name="theme"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (r.checked) {
        state.settings = saveSettings({ theme: r.value });
        ui.applyTheme(r.value);
        applyAtmosphereNow(); // Midnight ↔ other themes changes the auto atmosphere
      }
    })
  );
  document.querySelectorAll('input[name="atmosphere"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (r.checked) {
        state.settings = saveSettings({ atmosphere: r.value });
        applyAtmosphereNow();
      }
    })
  );
  document.querySelectorAll('input[name="temp-unit"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (r.checked) {
        state.settings = saveSettings({ tempUnit: r.value });
        recompute();
      }
    })
  );
  document.querySelectorAll('input[name="reduced-motion"]').forEach((r) =>
    r.addEventListener("change", () => {
      if (r.checked) {
        state.settings = saveSettings({ reducedMotion: r.value });
        ui.applyMotion(r.value);
        applyAtmosphereNow(); // particles are gated by motion
      }
    })
  );

  // Data actions (destructive → confirm, then toast).
  $("clear-recent").addEventListener("click", () => {
    if (!confirm("Clear your recent locations?")) return;
    clearRecentSearches();
    refreshQuickLists();
    ui.toast("Recent locations cleared");
  });
  $("clear-saved").addEventListener("click", () => {
    if (!confirm("Clear your saved locations?")) return;
    clearSavedLocations();
    refreshQuickLists();
    updateSaveButton();
    ui.toast("Saved locations cleared");
  });
  $("reset-school").addEventListener("click", () => {
    if (!confirm("Reset school settings to their defaults?")) return;
    state.settings = resetSchoolSettings();
    applySettings();
    recompute();
    ui.toast("School settings reset");
  });
  $("reset-prefs").addEventListener("click", () => {
    if (!confirm("Reset all preferences to defaults? Your saved and recent locations are kept.")) return;
    state.settings = resetPreferences();
    applySettings();
    recompute();
    ui.toast("Preferences reset");
  });

  // Quick theme toggle in the header cycles light ↔ midnight.
  $("theme-toggle").addEventListener("click", () => {
    const isDark = ["dark", "midnight", "frost", "slate"].includes(
      document.documentElement.getAttribute("data-theme")
    );
    const next = isDark ? "light" : "midnight";
    state.settings = saveSettings({ theme: next });
    ui.applyTheme(next);
    setRadio("theme", next);
    applyAtmosphereNow();
  });
}

// --- Wire context controls ----------------------------------------------

function wireContext() {
  ["school-type", "area-type"].forEach((id) =>
    $(id).addEventListener("change", () => {
      persistSchoolContext();
      recompute();
    })
  );
  $("sensitivity").addEventListener("input", () => {
    updateSensitivityOutput();
    persistSchoolContext();
  });
  $("sensitivity").addEventListener("change", recompute);
  ["days-used", "days-allowed"].forEach((id) =>
    $(id).addEventListener("change", () => {
      validateDays();
      persistSchoolContext();
      recompute();
    })
  );
}

// --- Helpers -------------------------------------------------------------

/** AbortSignal that fires after `ms` (for network timeouts). */
function timeoutSignal(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function applyUrlOverrides() {
  const u = readUrlState();
  const patch = {};
  if (u.school) patch.schoolType = u.school;
  if (u.area) patch.areaType = u.area;
  if (Number.isFinite(u.sens)) patch.districtSensitivity = u.sens;
  if (Number.isFinite(u.used)) patch.snowDaysUsed = u.used;
  if (Number.isFinite(u.allowed)) patch.snowDaysAllowed = u.allowed;
  if (u.unit) patch.tempUnit = u.unit;
  if (u.theme) patch.theme = u.theme;
  if (Object.keys(patch).length) state.settings = saveSettings(patch);
  return u;
}

// --- Init ----------------------------------------------------------------

function init() {
  const urlState = applyUrlOverrides();
  applySettings();
  refreshQuickLists();
  refreshCalendarNotices();
  wireSettings();
  wireContext();

  const versionEl = $("app-version");
  if (versionEl) versionEl.textContent = `SnowSignal v${APP_VERSION}`;

  // Search wiring
  $("location").addEventListener("input", onSearchInput);
  $("location").addEventListener("keydown", onSearchKeydown);
  $("location").addEventListener("blur", () => setTimeout(ui.closeSuggestions, 150));
  $("geo-btn").addEventListener("click", useMyLocation);
  $("copy-btn").addEventListener("click", onCopySummary);
  $("share-btn").addEventListener("click", onCopyShareLink);
  $("save-btn").addEventListener("click", onSaveLocation);
  $("retry-btn").addEventListener("click", () => {
    if (state.place) loadPlace(state.place);
  });

  // React to OS theme changes while on "system".
  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (state.settings.theme === "system") {
          ui.applyTheme("system");
          applyAtmosphereNow();
        }
      });
  }

  // Auto-load from a shared URL (lat/lon or a place name).
  if (Number.isFinite(urlState.lat) && Number.isFinite(urlState.lon)) {
    loadPlace({
      name: urlState.loc || "Shared location",
      latitude: urlState.lat,
      longitude: urlState.lon,
    });
  } else if (urlState.loc) {
    findPlace(urlState.loc)
      .then(loadPlace)
      .catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
