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

function requireAdb(result, operation) {
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(`${operation} failed: ${output || `exit ${result.status}`}`);
  }
}

function launch(url) {
  const result = adb(
    'shell',
    'am',
    'start',
    '-W',
    '-a',
    'android.intent.action.VIEW',
    '-c',
    'android.intent.category.DEFAULT',
    '-d',
    `'${url}'`,
    config.appId,
  );
  requireAdb(result, `launch ${url}`);
}

function sleep(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

function readLogs() {
  const result = adb(
    'logcat',
    '-d',
    '-v',
    'brief',
    '-s',
    'ReactNativeJS:V',
    '*:S',
  );
  return `${result.stdout || ''}${result.stderr || ''}`;
}

const query = new URLSearchParams({
  dapp,
  method,
  params: JSON.stringify(parsedParams),
  runId,
  timeoutMs: String(Math.min(Math.max(timeoutMs - 5000, 1000), 60000)),
});
const url = `${config.scheme}://dev/dapp-provider?${query.toString()}`;
const reviewRunId = `review-${randomUUID()}`;
const deadline = Date.now() + timeoutMs;
let reviewLaunched = false;

try {
  requireAdb(adb('get-state'), 'device readiness');
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  adb('shell', 'wm', 'dismiss-keyguard');
  if (config.metroPort) {
    requireAdb(
      adb('reverse', `tcp:${config.metroPort}`, `tcp:${config.metroPort}`),
      'Metro reverse',
    );
  }
  requireAdb(adb('shell', 'am', 'force-stop', config.appId), 'stop app');
  requireAdb(adb('logcat', '-c'), 'clear logcat');
  launch(url);

  while (Date.now() < deadline) {
    const logs = readLogs();
    const reviewPending =
      logs.includes('RUBAN_DAPP_REVIEW_PENDING') &&
      logs.includes(`"method":"${method}"`);
    if (
      expected === 'review' &&
      reviewPending
    ) {
      console.log(
        `dapp-provider-smoke: PASS review-pending runId=${runId} method=${method}`,
      );
      process.exit(0);
    }
    if (reviewAction && reviewPending && !reviewLaunched) {
      const reviewQuery = new URLSearchParams({
        runId: reviewRunId,
        decision: reviewAction,
        method,
        timeoutMs: String(Math.min(timeoutMs - 1000, 60000)),
      });
      launch(`${config.scheme}://dev/dapp/review?${reviewQuery.toString()}`);
      reviewLaunched = true;
      await sleep(500);
      continue;
    }
    if (
      reviewAction &&
      logs.includes(`"runId":"${reviewRunId}"`) &&
      logs.includes('"status":"failed"')
    ) {
      throw new Error(`review intent failed: ${reviewRunId}`);
    }
    if (logs.includes(`RUBAN_DAPP_TEST PASSED runId=${runId} method=${method}`)) {
      if (expected !== 'pass') {
        throw new Error(`provider request passed; expected ${expected}`);
      }
      console.log(`dapp-provider-smoke: PASS runId=${runId} method=${method}`);
      process.exit(0);
    }
    if (logs.includes(`RUBAN_DAPP_TEST FAILED runId=${runId} method=${method}`)) {
      if (expected === 'fail') {
        console.log(
          `dapp-provider-smoke: PASS expected-failure runId=${runId} method=${method}`,
        );
        process.exit(0);
      }
      throw new Error(`provider request failed: runId=${runId} method=${method}`);
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for runId=${runId} method=${method}`);
} catch (error) {
  console.error('dapp-provider-smoke: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
