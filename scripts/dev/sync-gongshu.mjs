#!/usr/bin/env node
// Sync the gongshu sample apps with the current library state.
//
// Gongshu apps are standalone consumers, never workspace members. This script
// is the ONLY supported way the library reaches them:
//   1. copies the canonical demo screen into the app,
//   2. packs packages/react-native-progress into apps/<app>/ruban-local.tgz,
//   3. installs the app's own dependencies with the app's own package manager
//      (tarball installs are PM-neutral: npm/yarn/pnpm all accept .tgz).
//
// Usage:
//   node scripts/dev/sync-gongshu.mjs --app <gongshu-0.66|gongshu-0.76|gongshu-latest>
//   node scripts/dev/sync-gongshu.mjs --all [--skip-install]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const packageDir = path.join(repoRoot, 'packages', 'react-native-progress');
const appsRoot = path.join(repoRoot, 'apps');
const demoSource = path.join(repoRoot, 'scripts', 'dev', 'gongshu-demo', 'GongshuBench.js');
const APPS = ['gongshu-0.66', 'gongshu-0.76', 'gongshu-latest'];
const LOCAL_TARBALL = 'ruban-local.tgz';

function fail(message) {
  console.error(`sync-gongshu: ${message}`);
  process.exit(1);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${bin} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} ${args.join(' ')} exited with ${result.status}`);
}

function detectPackageManager(appDir) {
  if (fs.existsSync(path.join(appDir, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(appDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(appDir, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}

function ensureLibraryBuilt() {
  if (!fs.existsSync(path.join(packageDir, 'lib', 'commonjs'))) {
    console.log('sync-gongshu: lib/ missing, building library first');
    run('pnpm', ['--filter', '@ruban-labs/react-native-progress', 'build'], { cwd: repoRoot });
  }
}

function syncApp(app, options) {
  const appDir = path.join(appsRoot, app);
  if (!fs.existsSync(path.join(appDir, 'package.json'))) fail(`app ${app} not found`);

  fs.copyFileSync(demoSource, path.join(appDir, 'GongshuBench.js'));

  const manifestPath = path.join(appDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.dependencies['@ruban-labs/react-native-progress'] !== `file:./${LOCAL_TARBALL}`) {
    manifest.dependencies['@ruban-labs/react-native-progress'] = `file:./${LOCAL_TARBALL}`;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  run('npm', ['pack', packageDir, '--pack-destination', appDir]);
  const packed = fs.readdirSync(appDir).find((name) => name.endsWith('.tgz') && name !== LOCAL_TARBALL);
  if (!packed) fail(`no tarball produced in ${appDir}`);
  fs.rmSync(path.join(appDir, LOCAL_TARBALL), { force: true });
  fs.renameSync(path.join(appDir, packed), path.join(appDir, LOCAL_TARBALL));

  if (options.skipInstall) {
    console.log(`sync-gongshu: ${app} synced (install skipped)`);
    return;
  }

  const packageManager = detectPackageManager(appDir);
  console.log(`sync-gongshu: ${app} installing with ${packageManager} (Node ${process.version})`);
  if (packageManager === 'npm') {
    // --include=dev survives NODE_ENV=production shells.
    run('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], { cwd: appDir });
  } else if (packageManager === 'yarn') {
    run('yarn', ['install'], { cwd: appDir });
  } else {
    run('pnpm', ['install', '--include-dev'], { cwd: appDir });
  }
  console.log(`sync-gongshu: ${app} ready`);
}

const argv = process.argv.slice(2);
const skipInstall = argv.includes('--skip-install');
let selected = [];
if (argv.includes('--all')) {
  selected = APPS;
} else {
  const index = argv.indexOf('--app');
  const app = index >= 0 ? argv[index + 1] : null;
  if (!app || !APPS.includes(app)) fail(`expected --app <${APPS.join('|')}> or --all`);
  selected = [app];
}

ensureLibraryBuilt();
for (const app of selected) syncApp(app, { skipInstall });
