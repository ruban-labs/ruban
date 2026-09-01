#!/usr/bin/env node
// Deep-link product smoke runner for Gongshu apps on Android real devices.
// Every route is cold-started through its environment-specific scheme, then
// asserted through React Native test IDs exposed in the Android UI hierarchy.
//
// Usage:
//   node scripts/device/deeplink-smoke.mjs --era <latest|0.77|0.66> --device <serial>
//
// Prereq: the era's Metro must be running (latest 8091 / 0.77 8092 / 0.66 8093)
// and the debug app must already be installed.

import {spawnSync} from 'node:child_process';

const ERAS = {
  latest: {scheme: 'ruban-debug', metroPort: 8091, appId: 'com.rubanlabs.mobile.debug'},
  '0.77': {
    scheme: 'ruban-rn077-debug',
    metroPort: 8092,
    appId: 'com.rubanlabs.mobile.gongshu.rn077.debug',
  },
  '0.66': {
    scheme: 'ruban-rn066-debug',
    metroPort: 8093,
    appId: 'com.rubanlabs.mobile.gongshu.rn066.debug',
  },
};

const SCENARIOS = [
  {name: 'home', path: 'home', testId: 'screen-home'},
  {
    name: 'component-button',
    path: 'components/button?theme=light',
    testId: 'screen-component-button',
  },
  {
    name: 'playground-dark',
    path: 'lab/design?theme=dark',
    testId: 'screen-design-playground',
  },
  {
    name: 'settings-build',
    path: 'settings?sheet=build',
    testId: 'settings-sheet-build',
  },
];

const argv = process.argv.slice(2);
function arg(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

const era = arg('--era');
const device = arg('--device');
const timeoutMs = Number(arg('--timeout') || 90000);

if (!ERAS[era] || !device || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('usage: deeplink-smoke.mjs --era <latest|0.77|0.66> --device <serial>');
  process.exit(2);
}

const conf = ERAS[era];
const hierarchyPath = '/sdcard/ruban-deeplink-smoke.xml';
const deadline = Date.now() + timeoutMs;

function adb(...args) {
  return spawnSync('adb', ['-s', device, ...args], {encoding: 'utf8'});
}

function outputOf(result) {
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function requireAdb(result, operation) {
  if (result.status !== 0) {
    throw new Error(`${operation} failed: ${outputOf(result) || `exit ${result.status}`}`);
  }
}

function sleep(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

function readHierarchy() {
  const dumped = adb('shell', 'uiautomator', 'dump', hierarchyPath);
  if (dumped.status !== 0) {
    return '';
  }
  const read = adb('shell', 'cat', hierarchyPath);
  return read.status === 0 ? read.stdout || '' : '';
}

function visibleResourceIds(xml) {
  const ids = new Set();
  for (const match of xml.matchAll(/resource-id="([^"]+)"/g)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return [...ids].slice(0, 24);
}

async function waitForTestId(testId) {
  while (Date.now() < deadline) {
    const xml = readHierarchy();
    if (xml.includes(`resource-id="${testId}"`)) {
      return;
    }
    await sleep(750);
  }

  const xml = readHierarchy();
  throw new Error(
    `timed out waiting for ${testId}; visible resource IDs: ${visibleResourceIds(xml).join(', ')}`
  );
}

try {
  requireAdb(adb('get-state'), 'device readiness');
  requireAdb(adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'), 'wake device');
  adb('shell', 'wm', 'dismiss-keyguard');
  adb('shell', 'cmd', 'statusbar', 'collapse');
  requireAdb(
    adb('reverse', `tcp:${conf.metroPort}`, `tcp:${conf.metroPort}`),
    'Metro reverse'
  );

  for (const scenario of SCENARIOS) {
    requireAdb(adb('shell', 'am', 'force-stop', conf.appId), `stop ${scenario.name}`);
    const url = `${conf.scheme}://${scenario.path}`;
    const started = adb(
      'shell',
      'am',
      'start',
      '-W',
      '-a',
      'android.intent.action.VIEW',
      '-c',
      'android.intent.category.DEFAULT',
      '-d',
      url,
      conf.appId
    );
    requireAdb(started, `launch ${scenario.name}`);
    await waitForTestId(scenario.testId);
    console.log(`  ${scenario.name}: PASS (${scenario.testId})`);
  }

  console.log(`deeplink-smoke ${era}: PASS`);
} catch (error) {
  console.error(`deeplink-smoke ${era}: FAIL`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
