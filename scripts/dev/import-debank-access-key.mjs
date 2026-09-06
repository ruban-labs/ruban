#!/usr/bin/env node

import {createReadStream, lstatSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import process from 'node:process';

const defaultPackage = 'com.rubanlabs.mobile.debug';
const privateFile = 'files/ruban-debank-access-key';

function fail(message) {
  console.error(`import-debank-access-key: ${message}`);
  process.exit(1);
}

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fail(`${name} requires a value`) : fallback;
}

function runAdb(device, args) {
  const result = spawnSync('adb', ['-s', device, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail((result.stderr || result.stdout || 'adb failed').trim());
  return result.stdout;
}

async function stageCredential(device, packageName, sourceFile) {
  const child = spawn(
    'adb',
    [
      '-s',
      device,
      'shell',
      '-T',
      'run-as',
      packageName,
      'dd',
      `of=${privateFile}`,
    ],
    {stdio: ['pipe', 'ignore', 'pipe']},
  );
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    if (stderr.length < 4096) stderr += chunk;
  });
  createReadStream(sourceFile).pipe(child.stdin);
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (status !== 0) fail(stderr.trim() || `adb exited with ${status}`);
}

const device = option('--device');
const sourceFile = option('--source-file');
const packageName = option('--package', defaultPackage);
if (!device) fail('--device is required');
if (!sourceFile) fail('--source-file is required');
if (!/^[A-Za-z0-9._:-]+$/.test(device)) fail('invalid device serial');
if (!/^[a-zA-Z][a-zA-Z0-9_.]+$/.test(packageName)) fail('invalid package name');

const source = lstatSync(sourceFile);
if (!source.isFile() || source.isSymbolicLink() || source.size < 1 || source.size > 4096) {
  fail('source must be a regular 1-4096 byte file');
}

runAdb(device, ['shell', 'run-as', packageName, 'test', '-d', 'files']);
await stageCredential(device, packageName, sourceFile);
runAdb(device, ['shell', 'run-as', packageName, 'chmod', '600', privateFile]);
const stagedSize = Number(
  runAdb(device, ['shell', 'run-as', packageName, 'stat', '-c', '%s', privateFile]).trim(),
);
if (stagedSize !== source.size) fail('credential staging size mismatch');
const action = `${packageName}.action.IMPORT_DEBANK_ACCESS_KEY`;
const broadcast = runAdb(device, ['shell', 'am', 'broadcast', '-a', action, '-p', packageName]);
if (!/result=-1(?:\s|$)/.test(broadcast)) {
  fail('debug app rejected the credential import');
}
runAdb(device, ['shell', 'run-as', packageName, 'test', '!', '-e', privateFile]);
console.log(`import-debank-access-key: imported into ${packageName} on ${device}`);
