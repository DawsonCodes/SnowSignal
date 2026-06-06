// Project-metadata guards: MIT license presence and the beta.3 version stamp.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const VERSION = "1.0.0-beta.4";

test("a root MIT LICENSE file exists and GitHub can recognize it", () => {
  const license = read("LICENSE");
  assert.match(license, /MIT License/, "LICENSE must declare the MIT License");
  assert.match(license, /Permission is hereby granted, free of charge/, "standard MIT text");
  // Preserve the committed copyright holder exactly.
  assert.match(license, /Copyright \(c\) 2026 DawsonCodes/);
});

test("package.json is MIT-licensed and stamped at the beta.3 version", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.version, VERSION);
});

test("the app reports the beta.3 version in-app", () => {
  const main = read("js/main.js");
  assert.match(main, new RegExp(`APP_VERSION\\s*=\\s*"${VERSION.replace(/\./g, "\\.")}"`));
});

test("changelog and roadmap document beta.3", () => {
  assert.match(read("CHANGELOG.md"), /1\.0\.0-beta\.3/, "CHANGELOG has a beta.3 entry");
  assert.match(read("ROADMAP.md"), /1\.0\.0-beta\.3/, "ROADMAP references beta.3");
});

test("a CONTRIBUTING guide exists", () => {
  const contributing = read("CONTRIBUTING.md");
  assert.match(contributing, /pull request/i);
  assert.match(contributing, /node --test/, "asks contributors to run the test suite");
});
