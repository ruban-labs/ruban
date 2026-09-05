#!/usr/bin/env node

import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {appendFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';

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
let receiptServer = null;
let receiptServerPort = null;
const receivedReceipts = new Map();

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

function appendDiagnostic(message) {
  if (diagnosticLogPath) appendFileSync(diagnosticLogPath, `${message}\n`);
}

function startReceiptServer() {
  return new Promise((resolve, reject) => {
    if (diagnosticLogPath) writeFileSync(diagnosticLogPath, '');
    const server = createServer((request, response) => {
      if (request.method !== 'POST' || request.url !== '/receipt') {
        response.writeHead(404).end();
        return;
      }

      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => {
        body += chunk;
        if (body.length > 64 * 1024) request.destroy();
      });
      request.on('end', () => {
        try {
          const receipt = JSON.parse(body);
          if (typeof receipt?.runId !== 'string') throw new Error('runId');
          receivedReceipts.set(receipt.runId, receipt);
          appendDiagnostic(
            JSON.stringify({
              runId: receipt.runId,
              action: receipt.action,
              status: receipt.status,
            }),
          );
          response.writeHead(204).end();
        } catch {
          response.writeHead(400).end();
        }
      });
    });
    server.once('error', reject);
    server.listen({port: 0, host: '::', ipv6Only: false}, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('receipt server did not expose a TCP port'));
        return;
      }
      receiptServer = server;
      receiptServerPort = address.port;
      appendDiagnostic(`listening on localhost:${address.port}`);
      resolve();
    });
  });
}

function stopReceiptServer() {
  return new Promise(resolve => {
    if (!receiptServer) {
      resolve();
      return;
    }
    receiptServer.close(() => resolve());
  });
}

async function waitForReceipt(runId) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const callbackReceipt = receivedReceipts.get(runId);
    if (callbackReceipt) return callbackReceipt;
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
  await startReceiptServer();
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
    requireSuccess(
      adb(
        'reverse',
        `tcp:${receiptServerPort}`,
        `tcp:${receiptServerPort}`,
      ),
      'receipt server reverse',
    );
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
  }

  for (const [index, scenario] of scenarios.entries()) {
    const runId = `${workflowPrefix}-${index}`;
    const query = new URLSearchParams({
      runId,
      receiptUrl: `http://localhost:${receiptServerPort}/receipt`,
      ...scenario.query,
    });
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
  await stopReceiptServer();
}
