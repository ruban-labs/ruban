#!/usr/bin/env node
// Sync the gongshu sample apps with the current library state.
//
// Gongshu apps are standalone consumers, never workspace members. This script
// is the ONLY supported way Ruban packages reach them:
//   1. copies the canonical demo screen into the app,
//   2. packs each published package into an app-owned tarball,
//   3. installs the app's own dependencies with its pinned pnpm version.
//
// Usage:
//   node scripts/dev/sync-gongshu.mjs --app <gongshu-0.66|gongshu-0.77|gongshu-latest>
//   node scripts/dev/sync-gongshu.mjs --all [--skip-install]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const appsRoot = path.join(repoRoot, 'apps');
const demoSource = path.join(repoRoot, 'scripts', 'dev', 'gongshu-demo', 'GongshuBench.js');
const sourceRegistryScript = path.join(repoRoot, 'scripts', 'design', 'sync-source-registry.mjs');
const APPS = ['gongshu-0.66', 'gongshu-0.77', 'gongshu-latest'];
const LIBRARIES = [
  {
    name: '@ruban-labs/react-native-progress',
    directory: path.join(repoRoot, 'packages', 'react-native-progress'),
    tarball: 'ruban-local.tgz',
  },
  {
    name: '@ruban-labs/react-native-collapsible',
    directory: path.join(repoRoot, 'packages', 'react-native-collapsible'),
    tarball: 'ruban-collapsible-local.tgz',
  },
];

function fail(message) {
  console.error(`sync-gongshu: ${message}`);
  process.exit(1);
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${bin} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} ${args.join(' ')} exited with ${result.status}`);
}

function newestMtime(directory) {
  let newest = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    newest = Math.max(
      newest,
      entry.isDirectory() ? newestMtime(entryPath) : fs.statSync(entryPath).mtimeMs,
    );
  }
  return newest;
}

function ensureLibraryBuilt(library) {
  const sourceMtime = newestMtime(path.join(library.directory, 'src'));
  const outputDirs = ['commonjs', 'module', 'typescript'].map((target) =>
    path.join(library.directory, 'lib', target),
  );
  const outputIsStale = outputDirs.some(
    (directory) => !fs.existsSync(directory) || newestMtime(directory) < sourceMtime,
  );

  if (outputIsStale) {
    console.log(`sync-gongshu: ${library.name} lib/ missing or stale, building first`);
    run('pnpm', ['--filter', library.name, 'build'], { cwd: repoRoot });
  }
}

function assertInstalledSources(appDir) {
  for (const library of LIBRARIES) {
    const installedSource = path.join(appDir, 'node_modules', ...library.name.split('/'), 'src');
    for (const entry of fs.readdirSync(path.join(library.directory, 'src'), {withFileTypes: true})) {
      if (!entry.isFile()) continue;
      const expected = fs.readFileSync(path.join(library.directory, 'src', entry.name));
      const actual = fs.readFileSync(path.join(installedSource, entry.name));
      if (!expected.equals(actual)) {
        fail(`${path.basename(appDir)} installed stale ${library.name}/src/${entry.name}`);
      }
    }
  }
}

function packLibrary(library, appDir) {
  const temporaryDirectory = fs.mkdtempSync(path.join(appDir, '.ruban-pack-'));
  try {
    run('npm', ['pack', library.directory, '--pack-destination', temporaryDirectory]);
    const packed = fs.readdirSync(temporaryDirectory).find(name => name.endsWith('.tgz'));
    if (!packed) fail(`no tarball produced for ${library.name}`);
    fs.copyFileSync(path.join(temporaryDirectory, packed), path.join(appDir, library.tarball));
  } finally {
    fs.rmSync(temporaryDirectory, {recursive: true, force: true});
  }
}

function syncApp(app, options) {
  const appDir = path.join(appsRoot, app);
  if (!fs.existsSync(path.join(appDir, 'package.json'))) fail(`app ${app} not found`);

  run(process.execPath, [sourceRegistryScript, '--check', '--app', app], {cwd: repoRoot});

  fs.copyFileSync(demoSource, path.join(appDir, 'GongshuBench.js'));

  const manifestPath = path.join(appDir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.packageManager?.startsWith('pnpm@')) {
    fail(`${app} must pin pnpm in packageManager`);
  }
  if (!fs.existsSync(path.join(appDir, 'pnpm-workspace.yaml'))) {
    fail(`${app} must own a nested pnpm workspace boundary`);
  }
  if (fs.existsSync(path.join(appDir, 'package-lock.json'))) {
    fail(`${app} still has a legacy package-lock.json`);
  }
  let manifestChanged = false;
  for (const library of LIBRARIES) {
    const dependency = `file:./${library.tarball}`;
    if (manifest.dependencies[library.name] !== dependency) {
      manifest.dependencies[library.name] = dependency;
      manifestChanged = true;
    }
  }
  if (manifestChanged) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  for (const library of LIBRARIES) packLibrary(library, appDir);

  if (options.skipInstall) {
    console.log(`sync-gongshu: ${app} synced (install skipped)`);
    return;
  }

  for (const library of LIBRARIES) {
    fs.rmSync(path.join(appDir, 'node_modules', ...library.name.split('/')), {
      recursive: true,
      force: true,
    });
  }
  console.log(`sync-gongshu: ${app} installing with ${manifest.packageManager} (Node ${process.version})`);
  run('corepack', ['pnpm', 'install', '--force'], {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  assertInstalledSources(appDir);
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

for (const library of LIBRARIES) ensureLibraryBuilt(library);
for (const app of selected) syncApp(app, { skipInstall });
