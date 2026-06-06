// Regression test for the animation-replay fix in ui.renderResult, using a tiny
// DOM stub. A fresh forecast (entrance:true) replays the full reveal; a
// presentation/scoring update (entrance:false) must NOT re-add the "reveal" class
// and snaps the dial value into place instead of replaying the count-up.
import { test } from "node:test";
import assert from "node:assert/strict";

function makeEl() {
  const classes = new Set();
  const qcache = {};
  const attrs = {};
  const el = {
    children: [],
    tabIndex: 0,
    style: new Proxy({}, { get: () => "", set: () => true }),
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
    hidden: false,
    open: false,
    textContent: "",
    _html: "",
    set innerHTML(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
    get innerHTML() {
      return this._html;
    },
    get offsetWidth() {
      return 0;
    },
    setAttribute(k, v) {
      attrs[k] = String(v);
    },
    removeAttribute(k) {
      delete attrs[k];
    },
    getAttribute(k) {
      return k in attrs ? attrs[k] : null;
    },
    querySelector(sel) {
      return (qcache[sel] ||= makeEl());
    },
    querySelectorAll() {
      return [];
    },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    append(...cs) {
      this.children.push(...cs);
    },
    addEventListener() {},
    focus() {},
  };
  return el;
}

const byId = {};
globalThis.document = {
  getElementById: (id) => (byId[id] ||= makeEl()),
  createElement: () => makeEl(),
  createDocumentFragment: () => makeEl(),
  querySelector: () => makeEl(),
};
globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.requestAnimationFrame = () => 0; // no-op: don't drive entrance timers
globalThis.performance = { now: () => 0 };

const { renderResult, activateTab } = await import("../js/ui.js");

const baseResult = {
  closurePct: 42,
  delayPct: 10,
  confidence: "medium",
  recommendation: "Maybe.",
  factors: [
    { key: "ice", label: "Ice", detail: "d", points: 12, maxPoints: 30, direction: "positive" },
  ],
  gated: false,
  gateReason: "",
};
const baseMeta = {
  placeLabel: "Town",
  unit: "fahrenheit",
  timeline: [],
  weatherRows: [],
  forecastWindow: "Tonight",
  dateLabel: "Forecast for Monday, January 12",
  updatedLabel: "Updated 3:00 PM EST",
  animate: true,
};

test("a presentation/scoring update does not replay the reveal animation", () => {
  renderResult(baseResult, { ...baseMeta, entrance: false });
  const card = document.getElementById("result");
  assert.equal(card.classList.contains("reveal"), false, "no reveal replay on update");
  // The dial value snaps into place (no count-up) on an update.
  const pct = document.getElementById("dial-closure").querySelector(".dial-pct");
  assert.equal(pct.textContent, "42%");
});

test("a fresh forecast entrance replays the reveal animation", () => {
  renderResult(baseResult, { ...baseMeta, entrance: true });
  const card = document.getElementById("result");
  assert.equal(card.classList.contains("reveal"), true, "entrance adds the reveal class");
});

test("activateTab updates tab semantics and reveals only the matching panel", () => {
  const tabs = ["tab-appearance", "tab-weather", "tab-data", "tab-about"];
  const panels = ["panel-appearance", "panel-weather", "panel-data", "panel-about"];
  tabs.forEach((t, i) => document.getElementById(t).setAttribute("aria-controls", panels[i]));

  activateTab("tab-weather");

  assert.equal(document.getElementById("tab-weather").getAttribute("aria-selected"), "true");
  assert.equal(document.getElementById("tab-appearance").getAttribute("aria-selected"), "false");
  assert.equal(document.getElementById("tab-weather").tabIndex, 0, "selected tab is tabbable");
  assert.equal(document.getElementById("tab-appearance").tabIndex, -1, "unselected tabs use roving tabindex");
  assert.equal(document.getElementById("panel-weather").hidden, false, "matching panel shown");
  assert.equal(document.getElementById("panel-appearance").hidden, true, "other panels hidden");
  // The newly shown panel gets the restrained entrance animation class.
  assert.equal(document.getElementById("panel-weather").classList.contains("tab-anim"), true);
});

test("the gate explanation is shown only when the estimate is gated", () => {
  renderResult({ ...baseResult, gated: true, gateReason: "No hazard." }, { ...baseMeta, entrance: false });
  const gate = document.getElementById("gate-note");
  assert.equal(gate.hidden, false);
  assert.equal(gate.textContent, "No hazard.");
  renderResult(baseResult, { ...baseMeta, entrance: false });
  assert.equal(document.getElementById("gate-note").hidden, true);
});
