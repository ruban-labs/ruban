#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const minimumAlignment = 0x4000;
const supportedAbis = new Set(['arm64-v8a', 'x86_64']);

function fail(message) {
  console.error(`android-page-size: ${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    fail(`${command} ${args.join(' ')} exited with ${result.status}`);
  }
  return result.stdout;
}

function versionParts(value) {
  return value.split(/[^0-9]+/).filter(Boolean).map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right);
}

function newestTool(root, relativeCandidates) {
  if (!fs.existsSync(root)) fail(`Android tool root not found: ${root}`);
  const versions = fs.readdirSync(root).sort(compareVersions).reverse();
  for (const version of versions) {
    for (const relativePath of relativeCandidates) {
      const candidate = path.join(root, version, relativePath);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  fail(`required Android tool not found below ${root}`);
}

function extractArchiveEntry(artifact, archivePath, outputPath) {
  const result = spawnSync('unzip', ['-p', artifact, archivePath], {
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) fail(`unzip: ${result.error.message}`);
  if (result.status !== 0) {
    process.stderr.write(result.stderr?.toString('utf8') || '');
    fail(`unable to extract ${archivePath}`);
  }
  fs.writeFileSync(outputPath, result.stdout);
}

function collectNativeLibraries(artifact, extractionRoot) {
  const libraries = [];
  const archivePaths = run('unzip', ['-Z1', artifact])
    .split('\n')
    .filter(Boolean);

  for (const [index, archivePath] of archivePaths.entries()) {
    if (!archivePath.endsWith('.so')) continue;
    const segments = archivePath.split('/');
    const libIndex = segments.lastIndexOf('lib');
    const abi = libIndex === -1 ? null : segments[libIndex + 1];
    if (!supportedAbis.has(abi)) continue;

    const entryPath = path.join(extractionRoot, `${index}-${path.basename(archivePath)}`);
    extractArchiveEntry(artifact, archivePath, entryPath);
    libraries.push({abi, entryPath, relativePath: archivePath});
  }

  return libraries;
}

function loadAlignments(readelf, library) {
  const output = run(readelf, ['-lW', library]);
  return output
    .split('\n')
    .filter(line => /^\s*LOAD\s/.test(line))
    .map(line => Number.parseInt(line.trim().split(/\s+/).at(-1), 16));
}

const artifact = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!artifact || !fs.statSync(artifact, {throwIfNoEntry: false})?.isFile()) {
  fail('usage: node scripts/ci/check-android-page-size.mjs <apk-or-aab>');
}

const extension = path.extname(artifact).toLowerCase();
if (!['.apk', '.aab'].includes(extension)) fail('artifact must be an APK or AAB');

const sdkRoot = process.env.ANDROID_SDK_ROOT ||
  process.env.ANDROID_HOME ||
  path.join(os.homedir(), 'Library', 'Android', 'sdk');
const readelf = newestTool(path.join(sdkRoot, 'ndk'), [
  'toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf',
  'toolchains/llvm/prebuilt/darwin-x86_64/bin/llvm-readelf',
  'toolchains/llvm/prebuilt/darwin-arm64/bin/llvm-readelf',
]);

if (extension === '.apk') {
  const zipalign = newestTool(path.join(sdkRoot, 'build-tools'), ['zipalign']);
  run(zipalign, ['-c', '-P', '16', '4', artifact]);
}

const extractionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-page-size-'));
try {
  const libraries = collectNativeLibraries(artifact, extractionRoot);
  if (libraries.length === 0) fail('artifact contains no arm64-v8a or x86_64 libraries');

  const failures = [];
  let observedMinimum = Number.POSITIVE_INFINITY;
  for (const library of libraries) {
    const alignments = loadAlignments(readelf, library.entryPath);
    if (alignments.length === 0) {
      failures.push(`${library.relativePath}: no LOAD headers`);
      continue;
    }
    for (const alignment of alignments) {
      observedMinimum = Math.min(observedMinimum, alignment);
      if (!Number.isFinite(alignment) || alignment < minimumAlignment) {
        failures.push(`${library.relativePath}: p_align=0x${alignment.toString(16)}`);
      }
    }
  }

  if (failures.length > 0) fail(`16 KB alignment failed\n${failures.join('\n')}`);
  const zipStatus = extension === '.apk' ? 'pass' : 'play-managed';
  console.log(
    `android-page-size: zip=${zipStatus} elf=pass files=${libraries.length} ` +
      `minAlign=0x${observedMinimum.toString(16)}`,
  );
} finally {
  fs.rmSync(extractionRoot, {recursive: true, force: true});
}
