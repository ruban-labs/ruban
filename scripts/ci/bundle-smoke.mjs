#!/usr/bin/env node
// Bundle smoke test (CI matrix layer 4).
//
// Proves that a real bare RN app from each supported era can install the
// published tarballs and bundle them with Metro. Metro resolves each package
// through the `react-native` field (src/index), exactly like consumer apps.
//
// Usage:
//   node scripts/ci/bundle-smoke.mjs <pack|app|bundle|all> --era <era>
//
// Eras (RN version pins are bumped deliberately during maintenance):
//   rn-0.66    support floor (React 17, CLI 6)
//   rn-0.77    new architecture default boundary (React 18, CLI 15)
//   rn-latest  current stable (React 19, CLI 20)
//
// CI runs `pack` on the build Node, then `app` and `bundle` on the era's
// own Node version. `all` runs every phase locally in sequence.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const LIBRARIES = [
  {
    name: '@ruban-labs/react-native-progress',
    directory: path.join(repoRoot, 'packages', 'react-native-progress'),
    tarball: 'ruban-progress-local.tgz',
  },
  {
    name: '@ruban-labs/react-native-collapsible',
    directory: path.join(repoRoot, 'packages', 'react-native-collapsible'),
    tarball: 'ruban-collapsible-local.tgz',
  },
];

const ERAS = {
  'rn-0.66': {
    appName: 'RubanSmoke066',
    cli: '@react-native-community/cli@6.4.0',
    initArgs: ['--version', '0.66.4', '--npm', '--skip-install'],
    entry: 'App.js',
    eraNode: '16',
  },
  'rn-0.77': {
    appName: 'RubanSmoke077',
    cli: '@react-native-community/cli@15.1.3',
    initArgs: ['--version', '0.77.3', '--pm', 'npm', '--skip-install', '--skip-git-init'],
    entry: 'App.tsx',
    eraNode: '18',
  },
  'rn-latest': {
    appName: 'RubanSmokeLatest',
    cli: '@react-native-community/cli@20.2.0',
    initArgs: ['--version', '0.87.0', '--pm', 'npm', '--skip-install', '--skip-git-init'],
    entry: 'App.tsx',
    eraNode: '22',
  },
};

const SMOKE_MARKER = 'ruban-bundle-smoke';

function fail(message) {
  console.error(`bundle-smoke: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !['pack', 'app', 'bundle', 'all'].includes(command)) {
    fail('expected one of: pack | app | bundle | all');
  }
  let era = null;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === '--era') era = rest[index + 1];
  }
  if (!era || !ERAS[era]) {
    fail(`expected --era one of: ${Object.keys(ERAS).join(', ')}`);
  }
  return { command, era };
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, { stdio: 'inherit', ...options });
  if (result.error) fail(`${bin} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) fail(`${bin} ${args.join(' ')} exited with ${result.status}`);
}

function workdirFor(era) {
  return path.join(repoRoot, '.bundle-smoke', era);
}

function appDirFor(era) {
  return path.join(workdirFor(era), 'app');
}

function tarballFor(era, library) {
  const tarball = path.join(workdirFor(era), library.tarball);
  if (!fs.existsSync(tarball)) fail(`${library.tarball} missing - run the pack phase first`);
  return tarball;
}

function phasePack(era) {
  const workdir = workdirFor(era);
  fs.rmSync(workdir, { recursive: true, force: true });
  fs.mkdirSync(workdir, { recursive: true });
  for (const library of LIBRARIES) {
    const temporaryDirectory = fs.mkdtempSync(path.join(workdir, '.ruban-pack-'));
    try {
      run('npm', ['pack', library.directory, '--pack-destination', temporaryDirectory]);
      const packed = fs.readdirSync(temporaryDirectory).find(name => name.endsWith('.tgz'));
      if (!packed) fail(`no tarball produced for ${library.name}`);
      fs.copyFileSync(path.join(temporaryDirectory, packed), tarballForPath(era, library));
      console.log(`bundle-smoke: packed ${library.name} as ${library.tarball}`);
    } finally {
      fs.rmSync(temporaryDirectory, {recursive: true, force: true});
    }
  }
}

function tarballForPath(era, library) {
  return path.join(workdirFor(era), library.tarball);
}

function phaseApp(era) {
  const config = ERAS[era];
  const workdir = workdirFor(era);
  const appDir = appDirFor(era);
  const tarballs = LIBRARIES.map(library => tarballFor(era, library));

  fs.rmSync(appDir, { recursive: true, force: true });
  run('npx', ['--yes', config.cli, 'init', config.appName, ...config.initArgs, '--directory', appDir]);
  run('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], { cwd: appDir });
  run('npm', ['install', '--include=dev', '--no-audit', '--no-fund', ...tarballs], { cwd: appDir });

  const entryPath = path.join(appDir, config.entry);
  if (!fs.existsSync(entryPath)) fail(`entry ${entryPath} not found in generated app`);
  const original = fs.readFileSync(entryPath, 'utf8');
  if (!original.includes(SMOKE_MARKER)) {
    const patch = [
      "import { Bar as RubanBar } from '@ruban-labs/react-native-progress';",
      "import RubanCollapsible, { Accordion as RubanAccordion } from '@ruban-labs/react-native-collapsible';",
      `console.log('${SMOKE_MARKER}', RubanBar && RubanCollapsible && RubanAccordion ? 'ok' : 'missing');`,
      '',
      original,
    ].join('\n');
    fs.writeFileSync(entryPath, patch);
  }

  const appPkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  const installedRn = JSON.parse(fs.readFileSync(path.join(appDir, 'node_modules', 'react-native', 'package.json'), 'utf8'));
  const installedProgress = JSON.parse(
    fs.readFileSync(path.join(appDir, 'node_modules', '@ruban-labs', 'react-native-progress', 'package.json'), 'utf8'),
  );
  const installedCollapsible = JSON.parse(
    fs.readFileSync(path.join(appDir, 'node_modules', '@ruban-labs', 'react-native-collapsible', 'package.json'), 'utf8'),
  );
  console.log(
    `bundle-smoke: ${era} app ready (react-native ${installedRn.version}, react ${appPkg.dependencies.react}, progress ${installedProgress.version}, collapsible ${installedCollapsible.version})`,
  );
}

function phaseBundle(era) {
  const appDir = appDirFor(era);
  if (!fs.existsSync(appDir)) fail(`app dir ${appDir} not found - run the app phase first`);
  const outDir = path.join(workdirFor(era), 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const bundlePath = path.join(outDir, 'index.android.bundle');

  // Metro <= 0.66 hashes with MD4, which Node 17+ OpenSSL 3 rejects.
  // CI runs this era on Node 16, where the legacy-provider flag must NOT be set.
  const env = { ...process.env };
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (era === 'rn-0.66' && nodeMajor >= 17) {
    env.NODE_OPTIONS = [env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' ');
  }

  run(
    'npx',
    [
      'react-native',
      'bundle',
      '--platform',
      'android',
      '--dev',
      'false',
      '--entry-file',
      'index.js',
      '--bundle-output',
      bundlePath,
      '--assets-dest',
      path.join(outDir, 'assets'),
    ],
    { cwd: appDir, env },
  );

  const stat = fs.statSync(bundlePath);
  if (stat.size < 100_000) fail(`bundle ${bundlePath} is only ${stat.size} bytes - our library likely did not make it in`);
  console.log(`bundle-smoke: ${era} bundled OK (${Math.round(stat.size / 1024)} KiB)`);
}

const { command, era } = parseArgs(process.argv.slice(2));
console.log(`bundle-smoke: era ${era} (era Node ${ERAS[era].eraNode}, actual Node ${process.version})`);

if (command === 'pack' || command === 'all') phasePack(era);
if (command === 'app' || command === 'all') phaseApp(era);
if (command === 'bundle' || command === 'all') phaseBundle(era);
