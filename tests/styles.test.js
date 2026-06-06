import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// Regression guard for the settings-modal-hidden hotfix.
//
// The app shows/hides UI via the `hidden` attribute/property, but several
// components set `display: flex`, which overrides the UA default for `[hidden]`
// and leaves them (notably the settings modal) stuck visible. A global
// `[hidden] { display: none !important }` rule restores the expected behavior.
// These tests fail if that override is removed or weakened.

test("base.css defines a global [hidden] override", () => {
  const css = read("css/base.css").replace(/\/\*[\s\S]*?\*\//g, ""); // strip comments
  const rule = /\[hidden\]\s*\{[^}]*\}/.exec(css);
  assert.ok(rule, "expected a `[hidden] { ... }` rule in css/base.css");

  const body = rule[0];
  assert.match(body, /display\s*:\s*none/, "[hidden] must set display: none");
  assert.match(body, /!important/, "[hidden] override must be !important to beat component `display` rules");
});

test("components that set `display` are covered by the [hidden] override", () => {
  // Sanity check that the conditions which caused the bug still exist, so this
  // guard stays meaningful: at least one toggled component sets `display`.
  const components = read("css/components.css");
  assert.match(
    components,
    /\.settings-panel\s*\{[^}]*display\s*:\s*flex/,
    ".settings-panel still sets display: flex (the original failure mode)",
  );
});

test("reduced-motion handling exists for both the OS query and the explicit setting", () => {
  const css = read("css/components.css");
  assert.match(css, /@media\s*\(prefers-reduced-motion: reduce\)/, "OS reduced-motion fallback");
  assert.match(css, /\[data-motion="reduce"\]/, "explicit Reduce-animations override");
});

test("the seasonal atmosphere layer never blocks clicks", () => {
  const css = read("css/components.css");
  const rule = /\.atmosphere\s*\{[^}]*\}/.exec(css);
  assert.ok(rule, "expected an .atmosphere rule");
  assert.match(rule[0], /pointer-events\s*:\s*none/, ".atmosphere must set pointer-events: none");
});

test("assets use relative paths so the app works under the /snowsignal/ subpath", () => {
  const html = read("index.html");
  assert.match(html, /href="\.\/css\/main\.css"/, "stylesheet must be referenced relatively");
  assert.match(html, /src="\.\/js\/main\.js"/, "entry script must be referenced relatively");
  // No root-absolute local asset paths (which would break under a project subpath).
  assert.equal(/(?:href|src)="\/(?!\/)/.test(html), false, "no root-absolute local asset paths");
  // The CSS entry point imports its partials relatively too.
  const mainCss = read("css/main.css");
  assert.match(mainCss, /@import\s+"\.\//, "css partials imported relatively");
});

test("retired themes leave no theme token blocks behind", () => {
  const tokens = read("css/tokens.css");
  for (const t of ["midnight", "frost", "slate"]) {
    assert.equal(
      new RegExp(`\\[data-theme="${t}"\\]`).test(tokens),
      false,
      `css/tokens.css should not define a "${t}" theme`
    );
  }
  // The two surviving themes remain.
  assert.match(tokens, /\[data-theme="dark"\]/, "dark theme retained");
});

test("accent is hue-driven via a CSS custom property", () => {
  const tokens = read("css/tokens.css");
  assert.match(tokens, /--accent-h:/, "an accent hue custom property is defined");
  assert.match(tokens, /--accent:\s*hsl\(var\(--accent-h\)/, "accent derives from the hue");
  // Semantic status colors stay fixed and distinct from the accent.
  assert.match(tokens, /--good:/);
  assert.match(tokens, /--warn:/);
  assert.match(tokens, /--bad:/);
});

test("settings modal is the wider tabbed layout", () => {
  const html = read("index.html");
  assert.match(html, /role="tablist"/, "settings use a tablist");
  assert.match(html, /id="panel-appearance"[^>]*role="tabpanel"/, "appearance tabpanel exists");
  assert.match(html, /id="panel-about"[^>]*role="tabpanel"/, "about tabpanel exists");
  const components = read("css/components.css");
  const inner = /\.settings-inner\s*\{[^}]*\}/.exec(components);
  assert.ok(inner, "expected a .settings-inner rule");
  assert.match(inner[0], /max-width:\s*7\d\dpx/, "settings modal widened to ~700–820px");
});

test("schedule context is a separate panel hidden until a result exists", () => {
  const html = read("index.html");
  assert.match(html, /id="schedule-context"[^>]*hidden/, "schedule-context starts hidden");
  assert.match(html, /class="card schedule-context"/, "schedule context is its own card");
});

test("light and dark atmospheres are tuned separately", () => {
  const css = read("css/components.css");
  assert.match(
    css,
    /:root\[data-theme="light"\]\s+\.atmosphere\[data-season="winter"\]/,
    "light-theme winter particles are re-tinted for contrast"
  );
  assert.match(
    css,
    /:root\[data-theme="light"\]\s+\.atmosphere\[data-season="summer"\]/,
    "light-theme summer particles are re-tinted too"
  );
});

test("refined seasonal atmospheres define their motion keyframes", () => {
  const css = read("css/components.css");
  assert.match(css, /@keyframes atm-sway-fall/, "spring sway keyframe");
  assert.match(css, /@keyframes atm-firefly/, "summer firefly keyframe");
  assert.match(css, /data-season="spring"[^}]*animation-name:\s*atm-sway-fall/, "spring uses the sway");
  assert.match(css, /data-season="summer"[^}]*animation-name:\s*atm-firefly/, "summer uses the firefly");
});

test("seasonal palette control and Auto badge exist in the Appearance tab", () => {
  const html = read("index.html");
  assert.match(html, /name="palette"[^>]*value="auto"/, "Auto palette option");
  assert.match(html, /name="palette"[^>]*value="custom"/, "Custom palette option");
  assert.match(html, /id="palette-auto-badge"/, "the read-only Auto palette badge");
});

test("semantic status colors are fixed and NOT hue-driven", () => {
  const tokens = read("css/tokens.css");
  // Each is a literal hex, never hsl(var(--accent-h) ...).
  assert.match(tokens, /--good:\s*#[0-9a-fA-F]{3,8}\s*;/);
  assert.match(tokens, /--warn:\s*#[0-9a-fA-F]{3,8}\s*;/);
  assert.match(tokens, /--bad:\s*#[0-9a-fA-F]{3,8}\s*;/);
  assert.equal(/--(?:good|warn|bad):\s*hsl\(var\(--accent-h\)/.test(tokens), false, "status colors must not follow the accent hue");
});

test("time-of-day ambient intensity is defined via data-daypart", () => {
  const tokens = read("css/tokens.css");
  assert.match(tokens, /\[data-daypart="day"\]/);
  assert.match(tokens, /\[data-daypart="evening"\]/);
  assert.match(tokens, /\[data-daypart="night"\][^}]*--glow-mult/);
  assert.match(tokens, /--glow-mult/, "ambient glow uses an intensity multiplier");
});

test("hourly timeline keeps subtle, smooth, overflow-safe scrolling", () => {
  const css = read("css/components.css");
  const rule = /\.timeline\s*\{[^}]*\}/.exec(css);
  assert.ok(rule, "expected a .timeline rule");
  assert.match(rule[0], /overflow-x:\s*auto/, "horizontal scrolling preserved");
  assert.match(rule[0], /scroll-behavior:\s*smooth/, "smooth scrolling");
  assert.match(rule[0], /scrollbar-width:\s*thin/, "subtle scrollbar");
  assert.match(css, /\.timeline-arrow/, "optional desktop scroll arrows are styled");
  // Arrows are desktop-only (declared display:none, revealed in a min-width query).
  assert.match(css, /\.timeline-arrow\s*\{[^}]*display:\s*none/);
});

test("settings tabs animate the underline and panel without reduced-motion regressions", () => {
  const css = read("css/components.css");
  assert.match(css, /\.settings-tab::after/, "animated underline pseudo-element");
  assert.match(css, /@keyframes tab-in/, "panel fade/slide keyframe");
  assert.match(css, /\.settings-panel-tab\.tab-anim/, "panel entrance class");
  // Reduced-motion handling must still be present so these are zeroed.
  assert.match(css, /@media\s*\(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[data-motion="reduce"\]/);
});

test("empty state has a restrained seasonal icon and a clearer prompt", () => {
  const html = read("index.html");
  assert.match(html, /id="empty-icon"/, "seasonal empty-state icon");
  assert.match(html, /Search a location to check tonight’s forecast\./, "clearer prompt");
});
