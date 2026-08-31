#!/usr/bin/env node

'use strict';

const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const mode = process.env.RUBAN_RELEASE_MODE || 'dev';
const realCli = process.env.RUBAN_REACT_NATIVE_CLI;

if (!realCli || !fs.existsSync(realCli)) {
  console.error('metro-cli: RUBAN_REACT_NATIVE_CLI must point to the era React Native CLI');
  process.exit(1);
}

let args = process.argv.slice(2);
if (args[0] === 'bundle') {
  args = args.filter(argument => argument !== '--reset-cache');
  if (mode !== 'release-fast') args.push('--reset-cache');
}

const result = spawnSync(process.execPath, [path.resolve(realCli), ...args], {
  cwd: process.env.RUBAN_APP_ROOT || process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`metro-cli: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
