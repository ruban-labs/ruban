#!/usr/bin/env node

import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const LANES = {
  debug: {
    scheme: 'ruban-debug',
    appId: 'com.rubanlabs.mobile.debug',
    metroPort: 8091,
  },
  regression: {
    scheme: 'ruban-regression',
    appId: 'com.rubanlabs.mobile.regression',
  },
};

const argv = process.argv.slice(2);
function arg(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

const device = arg('--device');
const lane = arg('--lane') || 'debug';
const dapp = arg('--dapp') || 'metamask';
const method = arg('--method') || 'eth_chainId';
const params = arg('--params') || '[]';
const runId = arg('--run-id') || `rpc-${randomUUID()}`;
const timeoutMs = Number(arg('--timeout') || 90000);
const expected = arg('--expect') || 'pass';
const reviewAction = arg('--review-action');
const config = LANES[lane];

if (
  !device ||
  !config ||
  !Number.isFinite(timeoutMs) ||
  timeoutMs <= 0 ||
  !['pass', 'fail', 'review'].includes(expected) ||
  (reviewAction && !['approve', 'reject'].includes(reviewAction))
) {
  console.error(
    'usage: dapp-provider-smoke.mjs --device <serial> [--lane debug|regression] [--dapp metamask] [--method eth_chainId] [--params JSON] [--run-id id] [--timeout ms] [--expect pass|fail|review] [--review-action approve|reject]',
  );
  process.exit(2);
}

let parsedParams;
try {
  parsedParams = JSON.parse(params);
} catch {
  console.error('--params must be valid JSON');
  process.exit(2);
}
if (!Array.isArray(parsedParams)) {
  console.error('--params must be a JSON array');
  process.exit(2);
}

function adb(...args) {
  return spawnSync('adb', ['-s', device, ...args], {encoding: 'utf8'});
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function requireAdb(result, operation) {
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(`${operation} failed: ${output || `exit ${result.status}`}`);
  }
}

function sleep(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

function readHierarchy() {
  const path = '/sdcard/ruban-dapp-provider-smoke.xml';
  const dumped = adb('shell', 'uiautomator', 'dump', path);
  if (dumped.status !== 0) return '';
  const read = adb('shell', 'cat', path);
  return read.status === 0 ? read.stdout || '' : '';
}

function readNodeBounds(hierarchy, resourceId) {
  const nodes = hierarchy.match(/<node\b[^>]*\/?/g) || [];
  const node = nodes.find(candidate =>
    candidate.includes(`resource-id="${resourceId}"`),
  );
  const bounds = node?.match(
    /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
  );
  return bounds ? bounds.slice(1).map(Number) : null;
}

function tapBounds(bounds) {
  const [left, top, right, bottom] = bounds;
  requireAdb(
    adb(
      'shell',
      'input',
      'tap',
      String(Math.round((left + right) / 2)),
      String(Math.round((top + bottom) / 2)),
    ),
    'tap review action',
  );
}

const query = new URLSearchParams({
  dapp,
  method,
  params: JSON.stringify(parsedParams),
  runId,
  timeoutMs: String(Math.min(Math.max(timeoutMs - 5000, 1000), 60000)),
});
const url = `${config.scheme}://dapp-test?${query.toString()}`;
const deadline = Date.now() + timeoutMs;
let reviewHandled = false;

try {
  requireAdb(adb('get-state'), 'device readiness');
  requireAdb(adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'), 'wake device');
  adb('shell', 'wm', 'dismiss-keyguard');
  if (config.metroPort) {
    requireAdb(
      adb('reverse', `tcp:${config.metroPort}`, `tcp:${config.metroPort}`),
      'Metro reverse',
    );
  }
  requireAdb(adb('shell', 'am', 'force-stop', config.appId), 'stop app');
  requireAdb(
    adb(
      'shell',
      [
        'am start -W',
        '-a android.intent.action.VIEW',
        '-c android.intent.category.DEFAULT',
        `-d ${shellQuote(url)}`,
        shellQuote(config.appId),
      ].join(' '),
    ),
    'launch DApp test',
  );

  while (Date.now() < deadline) {
    const hierarchy = readHierarchy();
    if (hierarchy.includes('resource-id="dapp-rpc-review-sheet"')) {
      if (expected === 'review') {
        console.log(
          `dapp-provider-smoke: PASS review-visible runId=${runId} method=${method}`,
        );
        process.exit(0);
      }
      if (reviewAction && !reviewHandled) {
        const actionId = `dapp-rpc-review-${reviewAction}`;
        const bounds = readNodeBounds(hierarchy, actionId);
        if (!bounds) throw new Error(`review action ${actionId} was not found`);
        tapBounds(bounds);
        reviewHandled = true;
        await sleep(500);
        continue;
      }
    }
    if (hierarchy.includes('resource-id="dapp-test-pass"')) {
      if (expected !== 'pass') {
        throw new Error(`provider request passed; expected ${expected}`);
      }
      console.log(`dapp-provider-smoke: PASS runId=${runId} method=${method}`);
      process.exit(0);
    }
    if (hierarchy.includes('resource-id="dapp-test-fail"')) {
      if (expected === 'fail') {
        console.log(
          `dapp-provider-smoke: PASS expected-failure runId=${runId} method=${method}`,
        );
        process.exit(0);
      }
      throw new Error(`provider request failed: runId=${runId} method=${method}`);
    }
    if (hierarchy.includes('resource-id="dapp-test-invalid"')) {
      throw new Error('DApp test deep link was invalid');
    }
    if (hierarchy.includes('resource-id="dapp-test-disabled"')) {
      throw new Error('DApp test deep link is disabled in this build');
    }
    await sleep(750);
  }
  throw new Error(`timed out waiting for runId=${runId} method=${method}`);
} catch (error) {
  console.error('dapp-provider-smoke: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
