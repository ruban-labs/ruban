#!/usr/bin/env node
// Deep-link smoke runner for gongshu sample apps on Android real devices.
// Shell `am start -a VIEW` is not subject to EMUI cross-app launch
// interception (which blocks maestro's on-device driver), so the scenario is
// driven in-app via a deep link and asserted through logcat markers emitted
// by GongshuE2e.js.
//
// Usage:
//   node scripts/device/deeplink-smoke.mjs --era <latest|0.76|0.66> --device <serial>
//
// Prereq: the era's Metro must be running (latest 8081 / 0.76 8082 / 0.66 8083)
// and the app installed. The runner sets `adb reverse tcp:8081 tcp:<port>`.

import { spawn, spawnSync } from 'node:child_process';

const ERAS = {
  latest: { scheme: 'gongshu-latest', metroPort: 8081, appId: 'com.gongshu.latest' },
  '0.76': { scheme: 'gongshu-0.76', metroPort: 8082, appId: 'com.gongshu.rn076' },
  '0.66': { scheme: 'gongshu-0.66', metroPort: 8083, appId: 'com.gongshu066' },
};

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
const era = arg('--era');
const device = arg('--device');
const timeoutMs = Number(arg('--timeout') || 90000);

if (!ERAS[era] || !device) {
  console.error('usage: deeplink-smoke.mjs --era <latest|0.76|0.66> --device <serial>');
  process.exit(2);
}
const conf = ERAS[era];

function adb(...args) {
  return spawnSync('adb', ['-s', device, ...args], { encoding: 'utf8' });
}

// Screen hygiene (locked screens silently break everything).
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
adb('shell', 'wm', 'dismiss-keyguard');
adb('shell', 'cmd', 'statusbar', 'collapse');
adb('reverse', 'tcp:8081', `tcp:${conf.metroPort}`);
adb('logcat', '-c');

const runId = 'r' + Date.now().toString(36);
const url = `${conf.scheme}://e2e?scenario=demo-smoke&runId=${runId}`;
const started = adb(
  'shell', 'am', 'start',
  '-a', 'android.intent.action.VIEW',
  '-c', 'android.intent.category.DEFAULT',
  '-d', url
);
if (started.status !== 0 || /Error/.test(started.stdout || '')) {
  console.error(`am start failed: ${(started.stdout || '') + (started.stderr || '')}`);
  process.exit(1);
}
console.log(`armed ${url}`);

const logcat = spawn('adb', ['-s', device, 'logcat'], { encoding: 'utf8' });
let buffer = '';
let settled = false;

function settle(ok) {
  if (settled) return;
  settled = true;
  logcat.kill();
  const lines = buffer.split('\n').filter((l) => l.includes('[GONGSHU-E2E]') && l.includes(runId));
  lines.forEach((l) => console.log('  ' + l.replace(/^.*\[GONGSHU-E2E\]/, '[GONGSHU-E2E]')));
  if (ok) {
    console.log(`deeplink-smoke ${era}: PASS`);
    process.exit(0);
  }
  console.error(`deeplink-smoke ${era}: FAIL`);
  process.exit(1);
}

logcat.stdout.on('data', (chunk) => {
  buffer += chunk;
  if (buffer.includes(`runId=${runId} result=PASS`)) settle(true);
  else if (buffer.includes(`runId=${runId} result=FAIL`)) settle(false);
});

setTimeout(() => {
  console.error(`timeout after ${timeoutMs}ms waiting for runId=${runId}`);
  settle(false);
}, timeoutMs);
