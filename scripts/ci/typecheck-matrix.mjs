#!/usr/bin/env node
// Consumer type-check matrix (CI matrix layer 2).
//
// Each fixture under fixtures/typecheck simulates a consumer app pinned to one
// RN era. The library is installed as a real packed tarball (never a file:
// directory symlink), so our d.ts files resolve react-native/@types against
// the fixture's own era deps instead of leaking into the monorepo.
//
// Usage:
//   node scripts/ci/typecheck-matrix.mjs --fixture <rn-0.66|rn-0.76|rn-latest>
//   node scripts/ci/typecheck-matrix.mjs --all
//
// Run `pnpm build` first so lib/typescript exists.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const packageDir = path.join(repoRoot, 'packages', 'react-native-progress');
const fixturesRoot = path.join(repoRoot, 'fixtures', 'typecheck');
const FIXTURES = ['rn-0.66', 'rn-0.76', 'rn-latest'];
const LOCAL_TARBALL = 'ruban-local.tgz';

function fail(message) {
  console.error(`typecheck-matrix: ${message}`);
  process.exit(1);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${bin} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} ${args.join(' ')} exited with ${result.status}`);
}

function runFixture(fixture) {
  const dir = path.join(fixturesRoot, fixture);
  if (!fs.existsSync(path.join(dir, 'package.json'))) fail(`fixture ${fixture} not found`);
  if (!fs.existsSync(path.join(packageDir, 'lib', 'typescript'))) {
    fail('lib/typescript not found - run `pnpm build` first');
  }

  console.log(`typecheck-matrix: ${fixture} packing library`);
  run('npm', ['pack', packageDir, '--pack-destination', dir]);
  const packed = fs
    .readdirSync(dir)
    .find((name) => name.endsWith('.tgz') && name !== LOCAL_TARBALL);
  if (!packed) fail(`no tarball produced in ${dir}`);
  fs.rmSync(path.join(dir, LOCAL_TARBALL), { force: true });
  fs.renameSync(path.join(dir, packed), path.join(dir, LOCAL_TARBALL));

  fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
  console.log(`typecheck-matrix: ${fixture} installing era deps (Node ${process.version})`);
  // --include=dev: era types/typescript are devDeps and must survive
  // NODE_ENV=production shells. --no-package-lock: the tarball dep would churn
  // the lock on every build; era deps are exact-pinned anyway.
  run(
    'npm',
    ['install', '--include=dev', '--no-audit', '--no-fund', '--no-package-lock'],
    { cwd: dir },
  );

  console.log(`typecheck-matrix: ${fixture} running tsc`);
  run('npx', ['tsc', '--noEmit'], { cwd: dir });
  console.log(`typecheck-matrix: ${fixture} OK`);
}

const argv = process.argv.slice(2);
let selected = [];
if (argv.includes('--all')) {
  selected = FIXTURES;
} else {
  const index = argv.indexOf('--fixture');
  const fixture = index >= 0 ? argv[index + 1] : null;
  if (!fixture || !FIXTURES.includes(fixture)) {
    fail(`expected --fixture <${FIXTURES.join('|')}> or --all`);
  }
  selected = [fixture];
}

for (const fixture of selected) runFixture(fixture);
