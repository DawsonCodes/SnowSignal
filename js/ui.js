// ui.js
// The ONLY module (besides main.js) that touches the DOM. It renders engine
// output, manages skeletons/errors, the settings dialog (with a focus trap),
// theme/motion application, and small flourishes like the toast and confetti.

import { formatTemp, formatInches, formatHourLabel } from "./format.js";

export const $ = (id) => document.getElementById(id);
const show = (elm) => elm && (elm.hidden = false);
const hide = (elm) => elm && (elm.hidden = true);

const DIAL_CIRCUMFERENCE = 326.7; // 2 * pi * r (r = 52)

// --- Theme + motion ------------------------------------------------------

const prefersDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Apply a theme preference, resolving "system" to light/dark at runtime. */
export function applyTheme(pref) {
  const resolved = pref === "system" ? (prefersDark() ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", resolved);
  const icon = $("theme-toggle-icon");
  if (icon) {
    const dark = ["dark", "midnight", "frost", "slate"].includes(resolved);
    icon.textContent = dark ? "☀️" : "🌙";
  }
}

/** Apply a motion preference: "system" yields to the OS media query. */
export function applyMotion(pref) {
  const root = document.documentElement;
  if (pref === "on") root.setAttribute("data-motion", "reduce");
  else if (pref === "off") root.setAttribute("data-motion", "full");
  else root.removeAttribute("data-motion"); // system → CSS media query decides
}

export function motionAllowed(pref) {
  if (pref === "on") return false;
  if (pref === "off") return true;
  return !prefersReducedMotion();
}

// --- States: skeleton / error / empty ------------------------------------

export function showSkeleton() {
  hide($("error-state"));
  hide($("result"));
  hide($("empty-state"));
  show($("skeleton"));
}

export function showError(message) {
  hide($("skeleton"));
  hide($("result"));
  hide($("empty-state"));
  $("error-message").textContent = message;
  show($("error-state"));
}

export function clearStates() {
  hide($("skeleton"));
  hide($("error-state"));
}

// --- Result rendering ----------------------------------------------------

function setDial(dialId, pct) {
  const dial = $(dialId);
  const fill = dial.querySelector(".dial-fill");
  fill.style.strokeDashoffset = String(DIAL_CIRCUMFERENCE * (1 - pct / 100));
  // Color the closure dial by severity.
  if (dialId === "dial-closure") {
    const color = pct >= 65 ? "var(--good)" : pct >= 35 ? "var(--warn)" : "var(--muted)";
    fill.style.stroke = color;
  }
  dial.querySelector(".dial-pct").textContent = `${pct}%`;
}

export function renderResult(result, meta) {
  clearStates();
  hide($("empty-state"));

  setDial("dial-closure", result.closurePct);
  setDial("dial-delay", result.delayPct);

  $("chip-location").textContent = meta.placeLabel || "Your location";
  const confChip = $("chip-confidence");
  confChip.textContent = `${result.confidence} confidence`;
  confChip.className = `chip confidence-${result.confidence}`;

  $("recommendation").textContent = result.recommendation;

  renderFactors(result.factors);
  renderTimeline(meta.timeline || [], meta.unit);

  const note = $("cache-note");
  if (meta.fromCache && meta.fetchedAt) {
    const t = new Date(meta.fetchedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    note.textContent = `Showing cached forecast from ${t}.`;
    show(note);
  } else {
    hide(note);
  }

  show($("result"));
}

function renderFactors(factors) {
  const list = $("factors");
  list.innerHTML = "";
  // Show the factors that actually move the needle, biggest first.
  const sorted = [...factors].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  for (const f of sorted) {
    if (Math.abs(f.points) < 0.5) continue;
    const li = document.createElement("li");
    li.className = `factor ${f.direction}`;
    const widthPct = Math.min(100, (Math.abs(f.points) / f.maxPoints) * 100);
    li.innerHTML = `
      <div class="factor-top">
        <span class="factor-label"></span>
        <span class="factor-detail"></span>
      </div>
      <div class="factor-bar"><span style="width:${widthPct}%"></span></div>`;
    li.querySelector(".factor-label").textContent = f.label;
    li.querySelector(".factor-detail").textContent = f.detail;
    list.appendChild(li);
  }
}

const WEATHER_ICON = (code) => {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌧️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 85 && code <= 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌡️";
};

function renderTimeline(timeline, unit) {
  const wrap = $("timeline");
  wrap.innerHTML = "";
  for (const h of timeline) {
    const div = document.createElement("div");
    div.className = "t-hour";
    const snow = h.snowIn > 0.05 ? formatInches(h.snowIn) : "";
    div.innerHTML = `
      <span class="t-time"></span>
      <span class="t-icon" aria-hidden="true">${WEATHER_ICON(h.code)}</span>
      <span class="t-temp"></span>
      <span class="t-snow"></span>`;
    div.querySelector(".t-time").textContent = formatHourLabel(h.time);
    div.querySelector(".t-temp").textContent = formatTemp(h.tempF, unit);
    div.querySelector(".t-snow").textContent = snow;
    wrap.appendChild(div);
  }
}

export function renderAlertBanner(alert) {
  const banner = $("alert-banner");
  if (!alert || !alert.hasWinterAlert) {
    hide(banner);
    return;
  }
  banner.className = `alert-banner severity-${alert.alertSeverity}`;
  $("alert-title").textContent = alert.event || "Winter weather alert";
  $("alert-text").textContent = alert.headline || "";
  show(banner);
}

// --- Saved / recent / suggestions ---------------------------------------

export function renderSavedLocations(list, { onSelect, onRemove }) {
  const group = $("saved-group");
  const container = $("saved-locations");
  container.innerHTML = "";
  if (!list.length) {
    hide(group);
    return;
  }
  for (const loc of list) {
    const chip = document.createElement("span");
    chip.className = "chip tappable";
    const label = document.createElement("span");
    label.textContent = loc.label;
    label.addEventListener("click", () => onSelect(loc));
    const x = document.createElement("span");
    x.className = "chip-x";
    x.textContent = "✕";
    x.setAttribute("role", "button");
    x.setAttribute("aria-label", `Remove ${loc.label}`);
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      onRemove(loc.id);
    });
    chip.append(label, x);
    container.appendChild(chip);
  }
  show(group);
}

export function renderRecentSearches(list, { onSelect }) {
  const group = $("recent-group");
  const container = $("recent-searches");
  container.innerHTML = "";
  if (!list.length) {
    hide(group);
    return;
  }
  for (const item of list) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip tappable";
    chip.textContent = item.name;
    chip.addEventListener("click", () => onSelect(item));
    container.appendChild(chip);
  }
  show(group);
}

/** Render the autocomplete dropdown. Returns nothing; main.js owns selection. */
export function renderSuggestions(places, { onSelect, formatLabel }) {
  const box = $("suggestions");
  const input = $("location");
  box.innerHTML = "";
  if (!places || !places.length) {
    hide(box);
    input.setAttribute("aria-expanded", "false");
    return;
  }
  places.forEach((place, idx) => {
    const li = document.createElement("li");
    li.id = `suggestion-${idx}`;
    li.setAttribute("role", "option");
    li.textContent = formatLabel(place);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep focus, fire before blur
      onSelect(place);
    });
    box.appendChild(li);
  });
  show(box);
  input.setAttribute("aria-expanded", "true");
}

export function closeSuggestions() {
  hide($("suggestions"));
  $("location").setAttribute("aria-expanded", "false");
}

// --- Settings dialog with focus trap ------------------------------------

let lastFocused = null;

export function openSettings() {
  const panel = $("settings-panel");
  lastFocused = document.activeElement;
  show(panel);
  const focusables = panel.querySelectorAll("button, input");
  if (focusables.length) focusables[0].focus();
  panel.addEventListener("keydown", trapFocus);
}

export function closeSettings() {
  const panel = $("settings-panel");
  hide(panel);
  panel.removeEventListener("keydown", trapFocus);
  if (lastFocused) lastFocused.focus();
}

function trapFocus(e) {
  if (e.key === "Escape") {
    closeSettings();
    return;
  }
  if (e.key !== "Tab") return;
  const panel = $("settings-panel");
  const items = [...panel.querySelectorAll("button, input")].filter((el) => !el.disabled);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// --- Misc flourishes -----------------------------------------------------

let toastTimer = null;
export function toast(message) {
  const t = $("toast");
  t.textContent = message;
  show(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(t), 2400);
}

export function launchConfetti() {
  const layer = $("confetti");
  const colors = ["#38bdf8", "#6366f1", "#22c55e", "#f59e0b", "#e2e8f0"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 3800);
  }
}
