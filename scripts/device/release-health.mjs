#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const eras = {
  latest: {
    schemes: {production: 'ruban', regression: 'ruban-regression', debug: 'ruban-debug'},
    appId: 'com.rubanlabs.mobile',
  },
  '0.76': {
    schemes: {
      production: 'ruban-rn076',
      regression: 'ruban-rn076-regression',
      debug: 'ruban-rn076-debug',
    },
    appId: 'com.rubanlabs.mobile.gongshu.rn076',
  },
  '0.66': {
    schemes: {
      production: 'ruban-rn066',
      regression: 'ruban-rn066-regression',
      debug: 'ruban-rn066-debug',
    },
    appId: 'com.rubanlabs.mobile.gongshu.rn066',
  },
};

const argv = process.argv.slice(2);

function arg(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function fail(message) {
  console.error(`release-health: ${message}`);
  process.exit(1);
}

const era = arg('--era');
const device = arg('--device');
const architecture = arg('--arch');
const manifestPath = arg('--manifest');
const timeoutMs = Number(arg('--timeout') || 90000);
const config = eras[era];
const appId = arg('--app-id') || config?.appId;
const lane = appId?.endsWith('.regression')
  ? 'regression'
  : appId?.endsWith('.debug')
    ? 'debug'
    : 'production';

if (!config || !device || (architecture !== 'old' && architecture !== 'new')) {
  fail('expected --era <0.66|0.76|latest> --device <serial> --arch <old|new>');
}

function adb(...args) {
  return spawnSync('adb', ['-s', device, ...args], {encoding: 'utf8'});
}

adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
adb('shell', 'wm', 'dismiss-keyguard');
adb('shell', 'cmd', 'statusbar', 'collapse');
adb('shell', 'am', 'force-stop', appId);
adb('logcat', '-c');

const runId = `r${Date.now().toString(36)}`;
const url = `${config.schemes[lane]}://release-health?runId=${runId}&expectedArch=${architecture}`;
const shellQuotedUrl = `'${url}'`;
const started = adb(
  'shell',
  'am',
  'start',
  '-a',
  'android.intent.action.VIEW',
  '-c',
  'android.intent.category.DEFAULT',
  '-d',
  shellQuotedUrl,
);

const startOutput = `${started.stdout || ''}${started.stderr || ''}`;
if (started.status !== 0 || /Error|unable to resolve/i.test(startOutput)) {
  fail(`am start failed: ${startOutput}`);
}

console.log(`release-health: armed ${url}`);

let settled = false;
let redelivered = false;

function updateManifest() {
  if (!manifestPath) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.hermes.runtimeVerified = true;
  manifest.runtimeVerification = {
    verifiedAt: new Date().toISOString(),
    scenario: 'release-health',
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function settle(passed) {
  if (settled) return;
  settled = true;
  const lines = readReleaseLogs()
    .split('\n')
    .filter(line => line.includes('[RUBAN-RELEASE]') && line.includes(`runId=${runId}`));
  lines.forEach(line =>
    console.log(`  ${line.replace(/^.*\[RUBAN-RELEASE\]/, '[RUBAN-RELEASE]')}`),
  );
  if (passed) {
    updateManifest();
    console.log(`release-health ${era}/${architecture}: PASS`);
    process.exit(0);
  }
  fail(`${era}/${architecture}: FAIL`);
}

function readReleaseLogs() {
  const result = adb('logcat', '-d', '-v', 'brief', '-s', 'ReactNativeJS:V', '*:S');
  return `${result.stdout || ''}${result.stderr || ''}`;
}

const poll = setInterval(() => {
  const buffer = readReleaseLogs();
  const expected = `runId=${runId} result=PASS engine=Hermes architecture=${architecture} channel=release`;
  if (buffer.includes(expected)) {
    clearInterval(poll);
    settle(true);
  } else if (buffer.includes(`runId=${runId} result=FAIL`)) {
    clearInterval(poll);
    settle(false);
  } else if (!redelivered && buffer.includes('[RUBAN-RELEASE] health-listener=READY')) {
    redelivered = true;
    adb(
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-c',
      'android.intent.category.DEFAULT',
      '-d',
      shellQuotedUrl,
    );
  }
}, 250);

setTimeout(() => {
  clearInterval(poll);
  console.error(`release-health: timeout after ${timeoutMs}ms waiting for runId=${runId}`);
  settle(false);
}, timeoutMs);
