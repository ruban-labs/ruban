import assert from "node:assert/strict";
import test from "node:test";

import { buildWorkflowOutputs, classifyChangedPaths } from "./changed-scope.mjs";

test("site-only changes skip package and native matrices", () => {
  const result = classifyChangedPaths(["website/src/pages/index.astro", "scripts/site/check.mjs"]);

  assert.equal(result.site, true);
  assert.equal(result.verify, false);
  assert.deepEqual(result.typecheck, []);
  assert.deepEqual(result.bundle, []);
  assert.deepEqual(result.ios, []);
});

test("documentation-only changes keep the required gate lightweight", () => {
  const result = classifyChangedPaths(["README.md", "docs/release.md"]);

  assert.equal(result.site, false);
  assert.equal(result.verify, false);
  assert.equal(result.full, false);
});

test("one standalone app selects only its iOS era", () => {
  const result = classifyChangedPaths(["apps/gongshu-0.77/src/App.tsx"]);

  assert.deepEqual(result.ios, ["rn-0.77"]);
  assert.deepEqual(result.typecheck, []);
  assert.deepEqual(result.bundle, []);
});

test("Android-only app changes do not start an iOS build", () => {
  const result = classifyChangedPaths(["apps/gongshu-latest/android/app/build.gradle"]);

  assert.deepEqual(result.ios, []);
  assert.equal(result.full, false);
});

test("one consumer fixture selects only its typecheck era", () => {
  const result = classifyChangedPaths(["fixtures/typecheck/rn-0.66/sample.tsx"]);

  assert.deepEqual(result.typecheck, ["rn-0.66"]);
  assert.deepEqual(result.ios, []);
});

test("source registry changes verify drift and every Gongshu era", () => {
  const result = classifyChangedPaths(["registry/native/ui/Input.tsx"]);

  assert.equal(result.verify, true);
  assert.equal(result.full, false);
  assert.deepEqual(result.ios, ["rn-0.66", "rn-0.77", "rn-latest"]);
});

test("shared package changes run every compatibility layer", () => {
  const result = classifyChangedPaths(["packages/react-native-progress/src/index.ts"]);

  assert.equal(result.full, true);
  assert.equal(result.verify, true);
  assert.equal(result.site, true);
  assert.deepEqual(result.typecheck, ["rn-0.66", "rn-0.77", "rn-latest"]);
  assert.deepEqual(result.bundle, ["rn-0.66", "rn-0.77", "rn-latest"]);
  assert.deepEqual(result.ios, ["rn-0.66", "rn-0.77", "rn-latest"]);
});

test("release tooling runs core verification without native smoke", () => {
  const result = classifyChangedPaths(["scripts/release/package.mjs"]);

  assert.equal(result.verify, true);
  assert.equal(result.full, false);
  assert.deepEqual(result.ios, []);
});

test("unknown paths fail safe to the full matrix", () => {
  const result = classifyChangedPaths(["tooling/new-runtime-file.ts"]);

  assert.equal(result.full, true);
});

test("workflow outputs contain only selected matrix rows", () => {
  const outputs = buildWorkflowOutputs(classifyChangedPaths(["apps/gongshu-0.66/App.tsx"]));

  assert.equal(outputs.ios, "true");
  assert.deepEqual(JSON.parse(outputs.ios_matrix).include.map((entry) => entry.era), ["0.66"]);
  assert.equal(outputs.typecheck, "false");
  assert.deepEqual(JSON.parse(outputs.typecheck_matrix), { include: [] });
});

test("manual runs force every matrix", () => {
  const outputs = buildWorkflowOutputs(classifyChangedPaths([], { forceFull: true }));

  assert.equal(outputs.full, "true");
  assert.equal(JSON.parse(outputs.typecheck_matrix).include.length, 3);
  assert.equal(JSON.parse(outputs.bundle_matrix).include.length, 3);
  assert.equal(JSON.parse(outputs.ios_matrix).include.length, 3);
});
