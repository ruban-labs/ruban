#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packagesRoot = path.join(repoRoot, 'packages');

function fail(message) {
  console.error(`package-contract: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasFileEntry(manifest, entry) {
  return Array.isArray(manifest.files) && manifest.files.includes(entry);
}

const packageDirectories = fs
  .readdirSync(packagesRoot, {withFileTypes: true})
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(packagesRoot, entry.name))
  .filter(packageDirectory => fs.existsSync(path.join(packageDirectory, 'package.json')))
  .sort();

if (packageDirectories.length === 0) {
  fail('no packages found');
}

for (const packageDirectory of packageDirectories) {
  const manifest = readJson(path.join(packageDirectory, 'package.json'));
  const label = manifest.name ?? path.basename(packageDirectory);
  const expectedNamePrefix = '@ruban-labs/react-native-';

  if (!label.startsWith(expectedNamePrefix)) fail(`${label}: package name must use ${expectedNamePrefix}`);
  if (manifest['react-native'] !== 'src/index') fail(`${label}: react-native must resolve to src/index`);
  if (manifest.main !== 'lib/commonjs/index.js') fail(`${label}: main must resolve to CommonJS output`);
  if (manifest.module !== 'lib/module/index.js') fail(`${label}: module must resolve to ESM output`);
  if (manifest.types !== 'lib/typescript/index.d.ts') fail(`${label}: types must resolve to generated declarations`);
  if (manifest.publishConfig?.access !== 'public') fail(`${label}: publishConfig.access must be public`);
  if (manifest.peerDependencies?.react !== '>=17.0.0') fail(`${label}: React peer floor must be >=17.0.0`);
  if (manifest.peerDependencies?.['react-native'] !== '>=0.66.0') fail(`${label}: React Native peer floor must be >=0.66.0`);
  if (manifest.ruban?.reactNativeFloor !== '0.66.0') fail(`${label}: ruban.reactNativeFloor must be 0.66.0`);
  if (typeof manifest.ruban?.nativeCode !== 'boolean') fail(`${label}: ruban.nativeCode must be boolean`);
  if (!['zero-dependency', 'peer-only', 'bare-react-native', 'native-contained'].includes(manifest.ruban?.runtimePolicy)) {
    fail(`${label}: unsupported ruban.runtimePolicy`);
  }
  if (manifest.ruban?.runtimePolicy === 'zero-dependency' && Object.keys(manifest.dependencies ?? {}).length > 0) {
    fail(`${label}: zero-dependency packages cannot declare runtime dependencies`);
  }
  if (['peer-only', 'bare-react-native'].includes(manifest.ruban?.runtimePolicy) && Object.keys(manifest.dependencies ?? {}).length > 0) {
    fail(`${label}: peer-only and bare-react-native packages cannot declare runtime dependencies`);
  }
  for (const entry of ['src', 'lib', 'NOTICE']) {
    if (!hasFileEntry(manifest, entry)) fail(`${label}: files must include ${entry}`);
  }

  if (manifest.ruban?.nativeCode) {
    for (const entry of ['android', 'ios']) {
      if (!hasFileEntry(manifest, entry)) fail(`${label}: native package files must include ${entry}`);
    }
    if (!hasFileEntry(manifest, 'rust') && !hasFileEntry(manifest, 'cpp')) {
      fail(`${label}: native package files must include rust or cpp core sources`);
    }
  }

  for (const script of ['build', 'test', 'typecheck']) {
    if (typeof manifest.scripts?.[script] !== 'string') fail(`${label}: missing ${script} script`);
  }

  const rootExport = manifest.exports?.['.'];
  if (rootExport?.types !== './lib/typescript/index.d.ts') fail(`${label}: exports.types is not the declaration entry`);
  if (rootExport?.['react-native'] !== './src/index.ts' && rootExport?.['react-native'] !== './src/index.tsx') {
    fail(`${label}: exports.react-native must point at the source entry`);
  }
  if (rootExport?.default !== './lib/commonjs/index.js') fail(`${label}: exports.default is not the safe CommonJS entry`);
  if (manifest.exports?.['./package.json'] !== './package.json') fail(`${label}: package.json export is missing`);

  for (const [subpath, subpathExport] of Object.entries(manifest.exports ?? {})) {
    if (subpath === '.' || subpath === './package.json') continue;

    if (!subpath.startsWith('./') || typeof subpathExport !== 'object' || subpathExport === null) {
      fail(`${label}: invalid subpath export ${subpath}`);
      continue;
    }

    const compatibilityEntry = subpath.slice(2);
    const compatibilityFiles = [`${compatibilityEntry}.js`, `${compatibilityEntry}.d.ts`];

    if (typeof subpathExport.types !== 'string' || !subpathExport.types.startsWith('./lib/typescript/')) {
      fail(`${label}: ${subpath} types must resolve to generated declarations`);
    }
    if (
      typeof subpathExport['react-native'] !== 'string' ||
      !subpathExport['react-native'].startsWith('./src/')
    ) {
      fail(`${label}: ${subpath} react-native must resolve to source`);
    }
    if (typeof subpathExport.default !== 'string' || !subpathExport.default.startsWith('./lib/commonjs/')) {
      fail(`${label}: ${subpath} default must resolve to CommonJS output`);
    }

    for (const compatibilityFile of compatibilityFiles) {
      if (!hasFileEntry(manifest, compatibilityFile)) {
        fail(`${label}: files must include legacy subpath entry ${compatibilityFile}`);
      }
      if (!fs.existsSync(path.join(packageDirectory, compatibilityFile))) {
        fail(`${label}: missing legacy subpath entry ${compatibilityFile}`);
      }
    }
  }

  for (const file of ['README.md', 'README.zh-CN.md', 'NOTICE']) {
    if (!fs.existsSync(path.join(packageDirectory, file))) fail(`${label}: missing ${file}`);
  }

  if (!process.exitCode) console.log(`package-contract: ${label} OK`);
}

if (process.exitCode) process.exit(process.exitCode);
