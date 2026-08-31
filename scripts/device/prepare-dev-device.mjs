#!/usr/bin/env node

import {spawnSync} from 'node:child_process';

const DEV_PORTS = [8091, 8092, 8093];
const argv = process.argv.slice(2);
const deviceIndex = argv.indexOf('--device');
const device = deviceIndex >= 0 ? argv[deviceIndex + 1] : null;

if (!device) {
  console.error('usage: prepare-dev-device.mjs --device <serial>');
  process.exit(2);
}

function adb(...args) {
  const result = spawnSync('adb', ['-s', device, ...args], {encoding: 'utf8'});
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    console.error(`adb ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
    process.exit(1);
  }
  return result.stdout;
}

adb('get-state');
const legacyRemoval = spawnSync(
  'adb',
  ['-s', device, 'reverse', '--remove', 'tcp:8081'],
  {encoding: 'utf8'},
);
const legacyRemovalDetail = `${legacyRemoval.stdout || ''}${legacyRemoval.stderr || ''}`;
if (legacyRemoval.status !== 0 && !legacyRemovalDetail.includes('not found')) {
  console.error(`failed to remove legacy 8081 mapping: ${legacyRemovalDetail.trim()}`);
  process.exit(1);
}
for (const port of DEV_PORTS) {
  adb('reverse', `tcp:${port}`, `tcp:${port}`);
}

const mappings = adb('reverse', '--list');
for (const port of DEV_PORTS) {
  if (!mappings.includes(`tcp:${port} tcp:${port}`)) {
    console.error(`missing reverse mapping for ${port}`);
    process.exit(1);
  }
}

console.log(`${device}: Gongshu Dev ports ready (${DEV_PORTS.join(', ')})`);
