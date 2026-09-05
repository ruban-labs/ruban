#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const sharedInputs = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/dev/sync-gongshu.mjs',
]);

const nativeExtensions = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.lock',
  '.m',
  '.mm',
  '.podspec',
  '.rs',
  '.swift',
  '.toml',
]);

function extension(file) {
  const basename = file.slice(file.lastIndexOf('/') + 1);
  const index = basename.indexOf('.');
  return index < 0 ? '' : basename.slice(index);
}

export function isIosNativeInput(file, app) {
  if (sharedInputs.has(file) || file.startsWith('patches/')) return true;
  if (file === `apps/${app}/package.json`) return true;
  if (file === `apps/${app}/react-native.config.js`) return true;
  if (file.startsWith(`apps/${app}/ios/`)) return true;
  if (!file.startsWith('packages/')) return false;
  if (file.endsWith('/package.json') || file.endsWith('/react-native.config.js')) {
    return true;
  }
  if (
    file.includes('/ios/') ||
    file.includes('/cpp/') ||
    file.includes('/native/') ||
    file.includes('/rust/')
  ) {
    return true;
  }
  return nativeExtensions.has(extension(file));
}

export function createIosNativeFingerprint(files, app, readFile = readFileSync) {
  const selected = files.filter(file => isIosNativeInput(file, app)).sort();
  const hash = createHash('sha256');
  for (const file of selected) {
    const contents = readFile(file);
    hash.update(`${file}\0${contents.length}\0`);
    hash.update(contents);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const app = readArg('--app');
  if (!app || !/^gongshu-(?:latest|0\.66|0\.77)$/.test(app)) {
    throw new Error('expected --app <gongshu-latest|gongshu-0.66|gongshu-0.77>');
  }
  const files = execFileSync('git', ['ls-files', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  process.stdout.write(createIosNativeFingerprint(files, app));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
