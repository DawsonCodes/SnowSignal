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
});
