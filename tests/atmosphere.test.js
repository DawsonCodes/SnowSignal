// Tests for the ambient atmosphere renderer using a tiny DOM stub. We verify the
// motion gate (no particles when motion is reduced) and that a season renders a
// small, bounded number of particles into the layer.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

function makeElement() {
  return {
    children: [],
    attrs: {},
    _html: "",
    style: { setProperty() {} },
    textContent: "",
    className: "",
    set innerHTML(v) {
      this._html = v;
      if (v === "") this.children = [];
    },
    get innerHTML() {
      return this._html;
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    removeAttribute(k) {
      delete this.attrs[k];
    },
    appendChild(c) {
      if (c && c.__frag) this.children.push(...c.children);
      else this.children.push(c);
      return c;
    },
  };
}

const layer = makeElement();
globalThis.document = {
  getElementById: (id) => (id === "atmosphere" ? layer : null),
  createElement: () => makeElement(),
  createDocumentFragment: () => ({
    __frag: true,
    children: [],
    appendChild(c) {
      this.children.push(c);
      return c;
    },
  }),
};

const { applyAtmosphere } = await import("../js/atmosphere.js");

beforeEach(() => {
  layer.children = [];
  layer.attrs = {};
});

test("reduced motion renders no particles", () => {
  applyAtmosphere({ pref: "winter", theme: "light", lat: 42, date: new Date(), motionAllowed: false });
  assert.equal(layer.children.length, 0);
  assert.equal(layer.attrs["data-season"], undefined);
});

test("a season renders a bounded number of particles and tags the layer", () => {
  // Use a different resolved season than the previous test to bypass the cache.
  applyAtmosphere({ pref: "summer", theme: "light", lat: 42, date: new Date(), motionAllowed: true });
  assert.equal(layer.attrs["data-season"], "summer");
  assert.ok(layer.children.length > 0 && layer.children.length <= 24, `count ${layer.children.length}`);
});

test("switching to Off clears the layer", () => {
  applyAtmosphere({ pref: "winter", theme: "light", lat: 42, date: new Date(), motionAllowed: true });
  assert.equal(layer.attrs["data-season"], "winter");
  applyAtmosphere({ pref: "off", theme: "light", lat: 42, date: new Date(), motionAllowed: true });
  assert.equal(layer.children.length, 0);
  assert.equal(layer.attrs["data-season"], undefined);
});
