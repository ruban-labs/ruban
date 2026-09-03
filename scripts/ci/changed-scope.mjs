import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const ERAS = ["rn-0.66", "rn-0.77", "rn-latest"];

const TYPECHECK_MATRIX = [
  { fixture: "rn-0.66", "era-node": 16 },
  { fixture: "rn-0.77", "era-node": 18 },
  { fixture: "rn-latest", "era-node": 22 },
];

const BUNDLE_MATRIX = [
  { era: "rn-0.66", "era-node": 16 },
  { era: "rn-0.77", "era-node": 18 },
  { era: "rn-latest", "era-node": 22 },
];

const IOS_MATRIX = [
  {
    era: "latest",
    app: "gongshu-latest",
    proj: "gongshulatest",
    "runs-on": "macos-15",
    "era-node": 22,
    xcode: "default",
    "metro-env": "",
  },
  {
    era: "0.77",
    app: "gongshu-0.77",
    proj: "gongshu077",
    "runs-on": "macos-14",
    "era-node": 18,
    xcode: "default",
    "metro-env": "",
  },
  {
    era: "0.66",
    app: "gongshu-0.66",
    proj: "gongshu066",
    "runs-on": "macos-14",
    "era-node": 18,
    xcode: "oldest",
    "metro-env": "NODE_OPTIONS=--openssl-legacy-provider",
  },
];

function addAll(target) {
  for (const era of ERAS) {
    target.add(era);
  }
}

function isDocumentationPath(path) {
  return (
    path === "LICENSE" ||
    path === "SECURITY.md" ||
    /^README(?:\.[^/]+)?$/.test(path) ||
    path.startsWith("docs/") ||
    path.startsWith("skills/") ||
    path.startsWith(".changeset/") ||
    path.startsWith("brand/store-assets/")
  );
}

function isSitePath(path) {
  return (
    path === ".github/workflows/pages.yml" ||
    path.startsWith("website/") ||
    path.startsWith("scripts/site/")
  );
}

function appEra(path) {
  const match = path.match(/^apps\/gongshu-(0\.66|0\.77|latest)\/(.+)$/);
  if (!match || match[2].startsWith("android/")) {
    return null;
  }

  return match[1] === "latest" ? "rn-latest" : `rn-${match[1]}`;
}

function fixtureEra(path) {
  const match = path.match(/^fixtures\/typecheck\/(rn-(?:0\.66|0\.77|latest))\//);
  return match?.[1] ?? null;
}

export function classifyChangedPaths(inputPaths, { forceFull = false } = {}) {
  const paths = [...new Set(inputPaths.map((path) => path.trim()).filter(Boolean))];
  const typecheck = new Set();
  const bundle = new Set();
  const ios = new Set();
  let verify = false;
  let site = false;
  let full = forceFull || paths.length === 0;

  for (const path of paths) {
    if (isSitePath(path)) {
      site = true;
      continue;
    }

    if (isDocumentationPath(path)) {
      continue;
    }

    const matchedAppEra = appEra(path);
    if (matchedAppEra) {
      ios.add(matchedAppEra);
      continue;
    }

    if (/^apps\/gongshu-(?:0\.66|0\.76|latest)\/android\//.test(path)) {
      continue;
    }

    const matchedFixtureEra = fixtureEra(path);
    if (matchedFixtureEra) {
      typecheck.add(matchedFixtureEra);
      continue;
    }

    if (path.startsWith("apps/gongshu-maestro/") || path === "scripts/dev/sync-gongshu.mjs") {
      addAll(ios);
      continue;
    }

    if (path.startsWith("registry/") || path === "scripts/design/sync-source-registry.mjs") {
      verify = true;
      addAll(ios);
      continue;
    }

    if (path === "scripts/ci/typecheck-matrix.mjs") {
      verify = true;
      addAll(typecheck);
      continue;
    }

    if (path === "scripts/ci/bundle-smoke.mjs") {
      verify = true;
      addAll(bundle);
      continue;
    }

    if (
      path === "scripts/ci/check-syntax-floor.mjs" ||
      path === "scripts/ci/mobile-release-plan.mjs" ||
      path === "scripts/ci/mobile-release-plan.test.mjs" ||
      path === ".github/workflows/mobile-release.yml" ||
      path.startsWith("scripts/release/") ||
      path.startsWith("scripts/device/") ||
      path.startsWith("fastlane/")
    ) {
      verify = true;
      continue;
    }

    if (
      path === ".github/workflows/ci.yml" ||
      path === "scripts/ci/changed-scope.mjs" ||
      path === "scripts/ci/changed-scope.test.mjs" ||
      path.startsWith("packages/") ||
      path.startsWith("design/") ||
      path.startsWith("brand/") ||
      path.startsWith("scripts/brand/") ||
      path.startsWith("scripts/design/") ||
      path === "package.json" ||
      path === "pnpm-lock.yaml" ||
      path === "pnpm-workspace.yaml"
    ) {
      full = true;
      continue;
    }

    full = true;
  }

  if (full) {
    verify = true;
    site = true;
    addAll(typecheck);
    addAll(bundle);
    addAll(ios);
  }

  return {
    paths,
    full,
    verify,
    site,
    typecheck: [...typecheck],
    bundle: [...bundle],
    ios: [...ios],
  };
}

function matrixFor(selected, matrix, key) {
  return {
    include: matrix.filter((entry) => selected.includes(entry[key])),
  };
}

export function buildWorkflowOutputs(classification) {
  const typecheckMatrix = matrixFor(classification.typecheck, TYPECHECK_MATRIX, "fixture");
  const bundleMatrix = matrixFor(classification.bundle, BUNDLE_MATRIX, "era");
  const selectedIosEras = classification.ios.map((era) => era.replace(/^rn-/, ""));
  const iosMatrix = matrixFor(selectedIosEras, IOS_MATRIX, "era");

  return {
    full: String(classification.full),
    verify: String(classification.verify),
    site: String(classification.site),
    typecheck: String(typecheckMatrix.include.length > 0),
    bundle: String(bundleMatrix.include.length > 0),
    ios: String(iosMatrix.include.length > 0),
    typecheck_matrix: JSON.stringify(typecheckMatrix),
    bundle_matrix: JSON.stringify(bundleMatrix),
    ios_matrix: JSON.stringify(iosMatrix),
  };
}

function validSha(value) {
  return /^[0-9a-f]{40}$/i.test(value ?? "") && !/^0+$/.test(value);
}

function changedPathsFromGit(baseSha, headSha) {
  if (!validSha(baseSha) || !validSha(headSha)) {
    throw new Error("A usable base/head SHA pair was not provided");
  }

  return execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRD", `${baseSha}..${headSha}`], {
    encoding: "utf8",
  }).split("\n");
}

function writeOutputs(outputs, outputPath) {
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? "local";
  const requestedFull = eventName === "workflow_dispatch" || process.env.FORCE_FULL === "true";
  let paths = [];
  let forceFull = requestedFull;
  let reason = requestedFull ? "manual-full" : "diff";

  if (!forceFull) {
    try {
      paths = changedPathsFromGit(process.env.BASE_SHA, process.env.HEAD_SHA);
    } catch (error) {
      forceFull = true;
      reason = `safe-fallback: ${error.message}`;
    }
  }

  const classification = classifyChangedPaths(paths, { forceFull });
  const outputs = buildWorkflowOutputs(classification);
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is required");
  }

  writeOutputs(outputs, outputPath);
  console.log(JSON.stringify({ reason, paths: classification.paths, ...outputs }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
