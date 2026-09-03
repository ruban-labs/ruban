#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const eras = {
  latest: {
    schemes: {production: 'ruban', regression: 'ruban-regression', debug: 'ruban-debug'},
    appId: 'com.rubanlabs.mobile',
  },
  '0.77': {
    schemes: {
      production: 'ruban-rn077',
      regression: 'ruban-rn077-regression',
      debug: 'ruban-rn077-debug',
    },
    appId: 'com.rubanlabs.mobile.gongshu.rn077',
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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`${command} exited with ${result.status}`);
  }
  return result;
}

const platform = arg('--platform');
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

if (
  (platform !== 'android' && platform !== 'ios') ||
  !config ||
  !device ||
  (architecture !== 'old' && architecture !== 'new')
) {
  fail(
    'expected --platform <android|ios> --era <0.66|0.77|latest> ' +
      '--device <serial|udid> --arch <old|new>',
  );
}

const runId = `r${Date.now().toString(36)}`;
const url = `${config.schemes[lane]}://release-health?runId=${runId}&expectedArch=${architecture}`;
const expected = `runId=${runId} result=PASS engine=Hermes architecture=${architecture} channel=release`;

function updateManifest() {
  if (!manifestPath) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.hermes.runtimeVerified = true;
  manifest.runtimeVerification = {
    verifiedAt: new Date().toISOString(),
    platform,
    scenario: 'release-health',
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function printMarkers(buffer) {
  buffer
    .split('\n')
    .filter(line => line.includes('[RUBAN-RELEASE]') && line.includes(runId))
    .forEach(line =>
      console.log(`  ${line.slice(line.indexOf('[RUBAN-RELEASE]'))}`),
    );
}

function pass(buffer) {
  printMarkers(buffer);
  updateManifest();
  console.log(`release-health ${platform}/${era}/${architecture}: PASS`);
}

function adb(...args) {
  return spawnSync('adb', ['-s', device, ...args], {encoding: 'utf8'});
}

function runAndroid() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
  adb('shell', 'cmd', 'statusbar', 'collapse');
  adb('shell', 'am', 'force-stop', appId);
  adb('logcat', '-c');

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
  const readLogs = () => {
    const result = adb('logcat', '-d', '-v', 'brief', '-s', 'ReactNativeJS:V', '*:S');
    return `${result.stdout || ''}${result.stderr || ''}`;
  };
  const settle = passed => {
    if (settled) return;
    settled = true;
    const buffer = readLogs();
    if (passed) {
      pass(buffer);
      process.exit(0);
    }
    printMarkers(buffer);
    fail(`${era}/${architecture}: FAIL`);
  };
  const poll = setInterval(() => {
    const buffer = readLogs();
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
}

function readIosLogArchive(temporaryRoot, attempt) {
  const tarPath = path.join(temporaryRoot, `device-${attempt}.tar`);
  const archivePath = path.join(temporaryRoot, `device-${attempt}.logarchive`);
  fs.mkdirSync(archivePath, {recursive: true});
  run('idevicesyslog', [
    '-u',
    device,
    'archive',
    tarPath,
    '--age-limit',
    '180',
    '--size-limit',
    '33554432',
  ]);
  run('tar', ['-xf', tarPath, '-C', archivePath]);
  const predicate = `eventMessage CONTAINS "${runId}"`;
  const shown = run('/usr/bin/log', [
    'show',
    '--archive',
    archivePath,
    '--style',
    'compact',
    '--info',
    '--debug',
    '--last',
    '5m',
    '--predicate',
    predicate,
  ]);
  return `${shown.stdout || ''}${shown.stderr || ''}`;
}

function runIos() {
  run('xcrun', [
    'devicectl',
    'device',
    'process',
    'launch',
    '--device',
    device,
    '--terminate-existing',
    '--timeout',
    '30',
    '--payload-url',
    url,
    appId,
  ], {inherit: true});
  console.log(`release-health: armed ${url}`);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-ios-health-'));
  fs.chmodSync(temporaryRoot, 0o700);
  let failedBuffer = null;
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      run('sleep', [attempt === 1 ? '2' : '1']);
      const buffer = readIosLogArchive(temporaryRoot, attempt);
      if (buffer.includes(expected)) {
        pass(buffer);
        return;
      }
      if (buffer.includes(`runId=${runId} result=FAIL`)) {
        failedBuffer = buffer;
        break;
      }
    }
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
  if (failedBuffer) {
    printMarkers(failedBuffer);
    fail(`${era}/${architecture}: FAIL`);
  }
  fail(`${era}/${architecture}: timed out waiting for iOS logarchive marker`);
}

try {
  if (platform === 'android') runAndroid();
  else runIos();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
