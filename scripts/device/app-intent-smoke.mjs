#!/usr/bin/env node

import {randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {appendFileSync, writeFileSync} from 'node:fs';

const ERAS = {
  latest: {
    schemes: {debug: 'ruban-debug', regression: 'ruban-regression'},
    appIds: {
      debug: 'com.rubanlabs.mobile.debug',
      regression: 'com.rubanlabs.mobile.regression',
    },
    metroPort: 8091,
  },
  '0.77': {
    schemes: {
      debug: 'ruban-rn077-debug',
      regression: 'ruban-rn077-regression',
    },
    appIds: {
      debug: 'com.rubanlabs.mobile.gongshu.rn077.debug',
      regression: 'com.rubanlabs.mobile.gongshu.rn077.regression',
    },
    metroPort: 8092,
  },
  '0.66': {
    schemes: {
      debug: 'ruban-rn066-debug',
      regression: 'ruban-rn066-regression',
    },
    appIds: {
      debug: 'com.rubanlabs.mobile.gongshu.rn066.debug',
      regression: 'com.rubanlabs.mobile.gongshu.rn066.regression',
    },
    metroPort: 8093,
  },
};

const argv = process.argv.slice(2);

function arg(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function fail(message) {
  console.error(`app-intent-smoke: ${message}`);
  process.exit(1);
}

const platform = arg('--platform');
const era = arg('--era');
const device = arg('--device');
const lane = arg('--lane') || 'debug';
const timeoutMs = Number(arg('--timeout') || 90000);
const config = ERAS[era];
const diagnosticLogPath = arg('--diagnostic-log');
const metroPort = Number(
  arg('--metro-port') || (platform === 'ios' ? 8081 : config?.metroPort),
);

if (
  !['android', 'ios'].includes(platform) ||
  !config ||
  !device ||
  !['debug', 'regression'].includes(lane) ||
  !Number.isFinite(timeoutMs) ||
  timeoutMs <= 0 ||
  !Number.isInteger(metroPort) ||
  metroPort <= 0 ||
  metroPort > 65535
) {
  fail(
    'expected --platform <android|ios> --era <0.66|0.77|latest> ' +
      '--device <serial|udid> [--lane debug|regression] [--timeout ms] ' +
      '[--metro-port port]',
  );
}

const scheme = config.schemes[lane];
const appId = config.appIds[lane];
const workflowPrefix = `intent-${era.replace('.', '')}-${randomUUID().slice(0, 8)}`;
const addressA = '0x1111111111111111111111111111111111111111';
const addressB = '0x2222222222222222222222222222222222222222';
const maxIosLogBytes = 2 * 1024 * 1024;
let iosLogBuffer = '';
let iosLogStream = null;
let iosLogStreamExit = null;

const scenarios = [
  {
    name: 'runtime ready',
    restart: true,
    path: 'runtime-ready',
    action: 'runtime.ready',
    query: {},
    verify(result) {
      return (
        result.edition === era &&
        result.engine === 'Hermes' &&
        result.platform === platform &&
        result.environment === lane
      );
    },
  },
  ...(era === 'latest'
    ? [
        {
          name: 'add address A',
          path: 'address/add',
          action: 'wallet.add-watch-address',
          query: {address: addressA, label: 'Intent A'},
          verify: result => result.address === addressA,
        },
        {
          name: 'select chain',
          path: 'chain/select',
          action: 'wallet.select-chain',
          query: {chainId: '8453'},
          verify: result => result.chainId === 8453,
        },
        {
          name: 'mock portfolio sync',
          path: 'portfolio/sync',
          action: 'portfolio.sync',
          query: {address: addressA, provider: 'mock'},
          verify: result =>
            result.address === addressA &&
            result.providerMode === 'mock' &&
            result.completedChains > 0 &&
            result.assetCount > 0,
        },
        {
          name: 'add address B',
          path: 'address/add',
          action: 'wallet.add-watch-address',
          query: {address: addressB, label: 'Intent B'},
          verify: result => result.address === addressB,
        },
        {
          name: 'select address A',
          path: 'address/select',
          action: 'wallet.select-account',
          query: {address: addressA},
          verify: result => result.address === addressA,
        },
        {
          name: 'delete address B',
          path: 'address/delete',
          action: 'wallet.delete-account',
          query: {address: addressB},
          verify: result => result.address === addressB,
        },
        {
          name: 'verify address A after restart',
          restart: true,
          path: 'address/select',
          action: 'wallet.select-account',
          query: {address: addressA},
          verify: result => result.address === addressA,
        },
      ]
    : []),
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  return result;
}

function adb(...args) {
  return run('adb', ['-s', device, ...args]);
}

function requireSuccess(result, operation) {
  if (result.status === 0) return;
  const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
  throw new Error(`${operation} failed: ${detail || `exit ${result.status}`}`);
}

function sleep(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

function appendIosLog(chunk) {
  const text = chunk.toString('utf8');
  iosLogBuffer = `${iosLogBuffer}${text}`.slice(-maxIosLogBytes);
  if (diagnosticLogPath) appendFileSync(diagnosticLogPath, text);
}

function startIosLogStream() {
  if (diagnosticLogPath) writeFileSync(diagnosticLogPath, '');
  const child = spawn(
    'xcrun',
    [
      'simctl',
      'spawn',
      device,
      'log',
      'stream',
      '--style',
      'compact',
      '--level',
      'debug',
      '--predicate',
      'eventMessage CONTAINS "RUBAN_APP_INTENT"',
    ],
    {stdio: ['ignore', 'pipe', 'pipe']},
  );
  child.stdout.on('data', appendIosLog);
  child.stderr.on('data', appendIosLog);
  child.on('error', error => {
    iosLogStreamExit = `error: ${error.message}`;
  });
  child.on('exit', (code, signal) => {
    iosLogStreamExit = `exit ${code ?? 'null'} signal ${signal ?? 'none'}`;
  });
  return child;
}

function stopIosLogStream() {
  if (iosLogStream && iosLogStream.exitCode === null) {
    iosLogStream.kill('SIGTERM');
  }
}

function parseReceipt(buffer, runId) {
  const marker = 'RUBAN_APP_INTENT_RECEIPT ';
  for (const line of buffer.split('\n')) {
    const markerIndex = line.indexOf(marker);
    if (markerIndex < 0) continue;
    const json = line.slice(markerIndex + marker.length).trim();
    try {
      const receipt = JSON.parse(json);
      if (receipt.runId === runId) return receipt;
    } catch {}
  }
  return null;
}

function readLogs(runId) {
  if (platform === 'android') {
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
  if (iosLogStreamExit) {
    throw new Error(`iOS log stream stopped: ${iosLogStreamExit}`);
  }
  return iosLogBuffer;
}

async function waitForReceipt(runId) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = parseReceipt(readLogs(runId), runId);
    if (receipt) return receipt;
    await sleep(500);
  }
  throw new Error(`timed out waiting for receipt ${runId}`);
}

function launch(url, restart = false) {
  if (platform === 'android') {
    if (restart) {
      requireSuccess(adb('shell', 'am', 'force-stop', appId), 'stop app');
    }
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
      appId,
    );
    requireSuccess(result, `launch ${url}`);
    return;
  }
  if (restart) run('xcrun', ['simctl', 'terminate', device, appId]);
  requireSuccess(
    run('xcrun', ['simctl', 'openurl', device, url]),
    `open ${url}`,
  );
}

try {
  if (platform === 'android') {
    requireSuccess(adb('get-state'), 'device readiness');
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
    adb('shell', 'wm', 'dismiss-keyguard');
    requireSuccess(
      adb(
        'reverse',
        `tcp:${metroPort}`,
        `tcp:${metroPort}`,
      ),
      'Metro reverse',
    );
    requireSuccess(adb('logcat', '-c'), 'clear logcat');
  } else {
    requireSuccess(
      run('xcrun', ['simctl', 'bootstatus', device, '-b']),
      'simulator readiness',
    );
    requireSuccess(
      run('xcrun', [
        'simctl',
        'spawn',
        device,
        'defaults',
        'write',
        appId,
        'RCT_jsLocation',
        `localhost:${metroPort}`,
      ]),
      'configure Metro location',
    );
    iosLogStream = startIosLogStream();
    await sleep(750);
    if (iosLogStreamExit) {
      throw new Error(`iOS log stream failed to start: ${iosLogStreamExit}`);
    }
  }

  for (const [index, scenario] of scenarios.entries()) {
    const runId = `${workflowPrefix}-${index}`;
    const query = new URLSearchParams({runId, ...scenario.query});
    const url = `${scheme}://dev/${scenario.path}?${query.toString()}`;
    launch(url, scenario.restart);
    const receipt = await waitForReceipt(runId);
    if (
      receipt.action !== scenario.action ||
      receipt.status !== 'succeeded' ||
      !receipt.result ||
      !scenario.verify(receipt.result)
    ) {
      throw new Error(
        `${scenario.name} returned ${JSON.stringify({
          action: receipt.action,
          status: receipt.status,
          result: receipt.result,
          errorCode: receipt.errorCode,
        })}`,
      );
    }
    console.log(`  ${scenario.name}: PASS (${runId})`);
  }

  console.log(`app-intent-smoke ${platform}/${era}/${lane}: PASS`);
} catch (error) {
  console.error(
    `app-intent-smoke: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  stopIosLogStream();
}
