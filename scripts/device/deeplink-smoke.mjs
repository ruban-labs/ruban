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
  {
    name: 'form-workbench-submit',
    path: 'components/form?theme=light',
    testId: 'screen-component-form-workbench',
    actions: [
      {tap: 'form-workbench-direction-code'},
      {tap: 'form-workbench-accepted'},
      {tap: 'form-workbench-accepted'},
      {tap: 'form-workbench-channel'},
      {waitFor: 'form-workbench-channel-sheet'},
      {tap: 'form-workbench-channel-option-push'},
      {tap: 'form-workbench-submit'},
      {waitFor: 'form-workbench-saved'},
      {waitForText: 'CODE · PUSH'},
    ],
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

async function waitForText(text) {
  while (Date.now() < deadline) {
    const xml = readHierarchy();
    if (xml.includes(`text="${text}"`)) {
      return;
    }
    await sleep(750);
  }

  throw new Error(`timed out waiting for text ${text}`);
}

function nodeBounds(xml, testId) {
  const nodes = xml.match(/<node\b[^>]*>/g) || [];
  const node = nodes.find(value => value.includes(`resource-id="${testId}"`));
  const match = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!match) {
    return null;
  }
  return match.slice(1).map(Number);
}

function screenSize() {
  const output = outputOf(adb('shell', 'wm', 'size'));
  const matches = [...output.matchAll(/(\d+)x(\d+)/g)];
  const selected = matches[matches.length - 1];
  return selected ? {width: Number(selected[1]), height: Number(selected[2])} : {width: 1080, height: 1920};
}

async function tapTestId(testId) {
  const size = screenSize();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const bounds = nodeBounds(readHierarchy(), testId);
    if (bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1]) {
      const x = Math.round((bounds[0] + bounds[2]) / 2);
      const y = Math.round((bounds[1] + bounds[3]) / 2);
      requireAdb(adb('shell', 'input', 'tap', String(x), String(y)), `tap ${testId}`);
      return;
    }

    requireAdb(
      adb(
        'shell',
        'input',
        'swipe',
        String(Math.round(size.width * 0.5)),
        String(Math.round(size.height * 0.8)),
        String(Math.round(size.width * 0.5)),
        String(Math.round(size.height * 0.3)),
        '650'
      ),
      `scroll to ${testId}`
    );
    await sleep(500);
  }

  throw new Error(`could not find tappable bounds for ${testId}`);
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
    for (const action of scenario.actions || []) {
      if (action.tap) {
        await tapTestId(action.tap);
        await sleep(250);
      } else if (action.waitFor) {
        await waitForTestId(action.waitFor);
      } else if (action.waitForText) {
        await waitForText(action.waitForText);
      }
    }
    console.log(`  ${scenario.name}: PASS (${scenario.testId})`);
  }

  console.log(`deeplink-smoke ${era}: PASS`);
} catch (error) {
  console.error(`deeplink-smoke ${era}: FAIL`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
