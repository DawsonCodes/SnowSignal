// atmosphere.js
// Lightweight seasonal ambient effects. Renders a small number of CSS-animated
// particles into the fixed, pointer-events:none `#atmosphere` layer. No images, no
// libraries. Season selection is delegated to the pure resolver in calendarContext;
// this module only owns the DOM.
//
// All motion is gated by the caller via `motionAllowed` — when animations are reduced
// (OS setting or the app's Motion control) we render nothing at all.

import { resolveAtmosphere } from "./calendarContext.js";

// Restrained particle counts — enough to feel alive, far from a snow globe.
const COUNTS = { winter: 18, spring: 12, summer: 14, fall: 10 };
const GLYPHS = {
  winter: ["❄", "❅", "•"],
  spring: ["✿", "❀", "•"],
  summer: ["•", "·"],
  fall: ["🍂", "🍁"],
};

// Remember what's rendered so we don't rebuild the DOM on unrelated updates.
let rendered = "__init__";

/**
 * Apply (or clear) the seasonal ambient layer.
 * @param {object} opts
 * @param {string} opts.pref           atmosphere preference (auto|winter|…|off)
 * @param {string} opts.theme          current concrete theme
 * @param {number|null} opts.lat
 * @param {Date} [opts.date]
 * @param {boolean} opts.motionAllowed
 */
export function applyAtmosphere({ pref, theme, lat, date, motionAllowed }) {
  const layer = document.getElementById("atmosphere");
  if (!layer) return;

  const season = motionAllowed
    ? resolveAtmosphere({ pref, theme, lat, date: date || new Date() })
    : null;

  if (season === rendered) return; // nothing changed → leave the DOM alone
  rendered = season;

  layer.innerHTML = "";
  if (!season) {
    layer.removeAttribute("data-season");
    return;
  }

  layer.setAttribute("data-season", season);
  const count = COUNTS[season] || 12;
  const glyphs = GLYPHS[season];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "atm-particle";
    p.textContent = glyphs[i % glyphs.length];
    const dur = 8 + Math.random() * 10; // 8–18s, slow and calm
    p.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    p.style.setProperty("--dur", `${dur.toFixed(2)}s`);
    p.style.setProperty("--delay", `${(-Math.random() * dur).toFixed(2)}s`); // pre-fill the screen
    p.style.setProperty("--x", `${((Math.random() * 2 - 1) * 40).toFixed(0)}px`);
    p.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
    p.style.setProperty("--o", (0.22 + Math.random() * 0.33).toFixed(2));
    frag.appendChild(p);
  }
  layer.appendChild(frag);
}
