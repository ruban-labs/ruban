#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const releaseCli = path.join(repoRoot, 'scripts', 'release', 'metro-cli.cjs');
const releaseHealth = path.join(repoRoot, 'scripts', 'device', 'release-health.mjs');
const modes = ['release-fast', 'release-clean', 'release-repro'];
const platforms = ['android', 'ios'];
const lanes = ['production', 'regression'];
const androidDistributions = ['internal', 'website', 'play'];
const iosDistributions = ['simulator', 'ad-hoc', 'app-store'];
const cocoaPodsVersion = '1.15.2';
const hermesMagic = Buffer.from('c61fbc03c103191f', 'hex');
const excludedDirectories = new Set([
  '.cache',
  '.cxx',
  '.gradle',
  'Pods',
  'artifacts',
  'build',
  'DerivedData',
  'node_modules',
]);

const apps = {
  '0.66': {
    aliases: ['0.66', 'gongshu-0.66'],
    directory: 'gongshu-0.66',
    reactNative: '0.66.4',
    architectures: ['old'],
    scheme: 'gongshu066',
    appIds: {
      production: 'com.rubanlabs.mobile.gongshu.rn066',
      regression: 'com.rubanlabs.mobile.gongshu.rn066.regression',
      debug: 'com.rubanlabs.mobile.gongshu.rn066.debug',
    },
    iosAdHoc: {
      production: {teamId: 'X4CK8ZXA45', profile: 'Ruban Gongshu Samples Ad Hoc'},
      regression: {teamId: 'X4CK8ZXA45', profile: 'Ruban Gongshu Samples Ad Hoc'},
    },
    legacyOpenSsl: true,
    exactJavaMajor: 17,
  },
  '0.77': {
    aliases: ['0.77', 'gongshu-0.77'],
    directory: 'gongshu-0.77',
    reactNative: '0.77.3',
    architectures: ['old', 'new'],
    scheme: 'gongshu077',
    appIds: {
      production: 'com.rubanlabs.mobile.gongshu.rn077',
      regression: 'com.rubanlabs.mobile.gongshu.rn077.regression',
      debug: 'com.rubanlabs.mobile.gongshu.rn077.debug',
    },
    iosAdHoc: {
      production: {teamId: 'X4CK8ZXA45', profile: 'Ruban Gongshu Samples Ad Hoc'},
      regression: {teamId: 'X4CK8ZXA45', profile: 'Ruban Gongshu Samples Ad Hoc'},
    },
    exactJavaMajor: 17,
  },
  latest: {
    aliases: ['latest', 'gongshu-latest'],
    directory: 'gongshu-latest',
    reactNative: '0.87.0',
    architectures: ['new'],
    scheme: 'gongshulatest',
    appIds: {
      production: 'com.rubanlabs.mobile',
      regression: 'com.rubanlabs.mobile.regression',
      debug: 'com.rubanlabs.mobile.debug',
    },
    iosAdHoc: {
      production: {teamId: 'X4CK8ZXA45', profile: 'Ruban Mobile Production Ad Hoc'},
      regression: {teamId: 'X4CK8ZXA45', profile: 'Ruban Mobile Regression Ad Hoc'},
    },
    iosAppStore: {teamId: 'X4CK8ZXA45', profile: 'Ruban Mobile App Store'},
    minimumJavaMajor: 17,
  },
};

function fail(message, exitCode = 1) {
  console.error(`gongshu-package: ${message}`);
  process.exit(exitCode);
}

function readAppVersion(appDir) {
  const packageJsonPath = path.join(appDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`${relativePath(packageJsonPath)} must define a numeric three-part version`);
  }
  return version;
}

function readBuildNumber() {
  const value = process.env.RUBAN_BUILD_NUMBER;
  if (!value) return null;
  if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 2100000000) {
    fail('RUBAN_BUILD_NUMBER must be an integer between 1 and 2100000000');
  }
  return value;
}

function usage() {
  console.log(`usage:
  node scripts/release/package.mjs \\
    --app <0.66|0.77|latest> \\
    --platform <android|ios> \\
    [--lane <production|regression>] \\
    [--arch <old|new>] \\
    [--mode <release-fast|release-clean|release-repro>] \\
    [--android-distribution <internal|website|play>] \\
    [--ios-distribution <simulator|ad-hoc|app-store>] \\
    [--device <android-serial|ios-udid>] [--skip-sync] [--dry-run]

Examples:
  pnpm gongshu:package --app 0.66 --platform android --lane regression --mode release-fast
  pnpm gongshu:package --app 0.77 --platform android --lane production --arch old --mode release-clean
  pnpm gongshu:package --app latest --platform android --lane production --android-distribution play
  pnpm gongshu:package --app latest --platform ios --lane regression --ios-distribution ad-hoc
  pnpm gongshu:package --app latest --platform ios --lane production --ios-distribution ad-hoc
  pnpm gongshu:package --app latest --platform ios --lane production --ios-distribution app-store`);
}

function parseOptions(argv) {
  const options = {
    app: null,
    platform: null,
    architecture: null,
    lane: 'production',
    mode: 'release-fast',
    androidDistribution: null,
    iosDistribution: 'simulator',
    device: null,
    sync: true,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--help' || current === '-h') {
      usage();
      process.exit(0);
    }
    if (current === '--skip-sync') {
      options.sync = false;
      continue;
    }
    if (current === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) fail(`${current} requires a value`, 2);
    if (current === '--app') options.app = value;
    else if (current === '--platform') options.platform = value;
    else if (current === '--arch') options.architecture = value;
    else if (current === '--lane') options.lane = value;
    else if (current === '--mode') options.mode = value;
    else if (current === '--android-distribution') options.androidDistribution = value;
    else if (current === '--ios-distribution') options.iosDistribution = value;
    else if (current === '--device') options.device = value;
    else fail(`unknown argument ${current}`, 2);
    index += 1;
  }

  return options;
}

function resolveApp(value) {
  return Object.entries(apps).find(([, config]) => config.aliases.includes(value || '')) || null;
}

function validateOptions(options) {
  const resolvedApp = resolveApp(options.app);
  if (!resolvedApp) fail('expected --app <0.66|0.77|latest>', 2);
  if (!platforms.includes(options.platform)) fail('expected --platform <android|ios>', 2);
  if (!lanes.includes(options.lane)) fail('expected --lane <production|regression>', 2);
  if (!modes.includes(options.mode)) {
    fail('expected --mode <release-fast|release-clean|release-repro>', 2);
  }
  if (options.androidDistribution && !androidDistributions.includes(options.androidDistribution)) {
    fail('expected --android-distribution <internal|website|play>', 2);
  }
  if (!iosDistributions.includes(options.iosDistribution)) {
    fail('expected --ios-distribution <simulator|ad-hoc|app-store>', 2);
  }

  const [era, app] = resolvedApp;
  if (!options.architecture && app.architectures.length === 1) {
    options.architecture = app.architectures[0];
  }
  if (!app.architectures.includes(options.architecture)) {
    fail(`${era} supports architecture cells: ${app.architectures.join(', ')}`, 2);
  }
  if (options.platform === 'android' && options.iosDistribution !== 'simulator') {
    fail('--ios-distribution is available only with --platform ios', 2);
  }
  if (options.platform === 'ios' && options.androidDistribution) {
    fail('--android-distribution is available only with --platform android', 2);
  }
  if (options.platform === 'android' && !options.androidDistribution) {
    options.androidDistribution = era === 'latest' && options.lane === 'production'
      ? 'website'
      : 'internal';
  }
  const isFormalAndroidRelease = era === 'latest' && options.lane === 'production';
  if (
    options.platform === 'android' &&
    isFormalAndroidRelease !== ['website', 'play'].includes(options.androidDistribution)
  ) {
    fail(
      isFormalAndroidRelease
        ? 'latest production requires website or play Android signing'
        : 'sample and regression Android packages require internal signing',
      2,
    );
  }
  if (options.androidDistribution === 'play' && options.device) {
    fail('Play AAB artifacts cannot be installed directly on a device', 2);
  }
  if (options.androidDistribution === 'play' && options.mode === 'release-repro') {
    fail('signed Play bundles require release-fast or release-clean', 2);
  }
  if (options.iosDistribution === 'ad-hoc' && options.mode === 'release-repro') {
    fail('signed ad-hoc archives require release-fast or release-clean', 2);
  }
  if (options.platform === 'ios' && options.device && options.iosDistribution !== 'ad-hoc') {
    fail('iOS --device installation requires --ios-distribution ad-hoc', 2);
  }
  if (
    options.iosDistribution === 'app-store' &&
    (era !== 'latest' || options.lane !== 'production')
  ) {
    fail('App Store packaging is available only for latest production', 2);
  }
  if (options.iosDistribution === 'app-store' && options.mode === 'release-repro') {
    fail('signed App Store archives require release-fast or release-clean', 2);
  }

  return {era, app};
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    encoding: options.capture ? 'utf8' : undefined,
    maxBuffer: 128 * 1024 * 1024,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) fail(`${commandName}: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
    }
    fail(`${commandName} ${args.join(' ')} exited with ${result.status}`);
  }
  return result;
}

function captured(commandName, args, options = {}) {
  const result = command(commandName, args, {...options, capture: true});
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function cocoaPodsEnvironment(env = process.env) {
  return {...env, BUNDLE_GEMFILE: path.join(repoRoot, 'Gemfile')};
}

function resolveCocoaPodsScript() {
  const result = spawnSync(
    'bundle',
    [
      'exec',
      'ruby',
      '-e',
      `require 'rubygems'; spec = Gem::Specification.find_by_name('cocoapods', '= ${cocoaPodsVersion}'); print File.join(spec.full_gem_path, 'bin', 'pod')`,
    ],
    {
      cwd: repoRoot,
      env: cocoaPodsEnvironment(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    fail(`CocoaPods ${cocoaPodsVersion} is not installed for the active Ruby`);
  }
  return result.stdout.trim();
}

function ensureExternalCacheRoot(cacheRoot) {
  if (!process.env.RUBAN_BUILD_CACHE_ROOT) return;
  const normalized = path.resolve(cacheRoot);
  if (!normalized.startsWith(`${path.sep}Volumes${path.sep}`)) return;
  const parts = normalized.split(path.sep).filter(Boolean);
  const volumeRoot = path.join(path.sep, parts[0], parts[1] || '');
  if (!parts[1] || !fs.existsSync(volumeRoot)) {
    fail(`configured external cache volume is not mounted: ${volumeRoot}`);
  }
}

function appendNodeOption(current, option) {
  const existing = current || '';
  return existing.includes(option) ? existing : `${existing} ${option}`.trim();
}

function collectFiles(targetPath, output) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    output.push({path: targetPath, link: fs.readlinkSync(targetPath)});
    return;
  }
  if (stat.isDirectory()) {
    if (excludedDirectories.has(path.basename(targetPath))) return;
    const entries = fs.readdirSync(targetPath).sort();
    entries.forEach(entry => collectFiles(path.join(targetPath, entry), output));
    return;
  }
  if (stat.isFile()) output.push({path: targetPath});
}

function inputKey(appDir, options, app) {
  const files = [];
  collectFiles(appDir, files);
  collectFiles(path.join(repoRoot, 'packages'), files);
  collectFiles(path.join(repoRoot, 'scripts', 'release'), files);
  collectFiles(releaseHealth, files);

  const hash = crypto.createHash('sha256');
  hash.update(
    JSON.stringify({
      schemaVersion: 1,
      era: app.reactNative,
      platform: options.platform,
      lane: options.lane,
      architecture: options.architecture,
      mode: options.mode,
      androidDistribution: options.platform === 'android' ? options.androidDistribution : null,
      iosDistribution: options.platform === 'ios' ? options.iosDistribution : null,
      node: process.version,
      os: process.platform,
      hostArchitecture: process.arch,
    }),
  );

  files
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach(entry => {
      hash.update(path.relative(repoRoot, entry.path));
      hash.update('\0');
      hash.update(entry.link === undefined ? fs.readFileSync(entry.path) : entry.link);
      hash.update('\0');
    });

  return hash.digest('hex').slice(0, 20);
}

function nativeCacheKey(appDir, options, app) {
  const files = [];
  collectFiles(path.join(appDir, options.platform), files);
  collectFiles(path.join(appDir, 'package.json'), files);
  collectFiles(path.join(appDir, 'pnpm-lock.yaml'), files);

  const hash = crypto.createHash('sha256');
  hash.update(
    JSON.stringify({
      schemaVersion: 1,
      reactNative: app.reactNative,
      platform: options.platform,
      lane: options.lane,
      architecture: options.architecture,
      androidDistribution: options.platform === 'android' ? options.androidDistribution : null,
      iosDistribution: options.platform === 'ios' ? options.iosDistribution : null,
      node: process.version,
      os: process.platform,
      hostArchitecture: process.arch,
    }),
  );
  files
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach(entry => {
      hash.update(path.relative(repoRoot, entry.path));
      hash.update('\0');
      hash.update(entry.link === undefined ? fs.readFileSync(entry.path) : entry.link);
      hash.update('\0');
    });
  return hash.digest('hex').slice(0, 20);
}

function findFiles(root, predicate) {
  const matches = [];
  if (!fs.existsSync(root)) return matches;
  const entries = fs.readdirSync(root, {withFileTypes: true}).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  entries.forEach(entry => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(entryPath, predicate));
    else if (entry.isFile() && predicate(entryPath)) matches.push(entryPath);
  });
  return matches;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Tree(directory) {
  const files = [];
  collectFiles(directory, files);
  const hash = crypto.createHash('sha256');
  files
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach(entry => {
      hash.update(path.relative(directory, entry.path));
      hash.update('\0');
      hash.update(entry.link === undefined ? fs.readFileSync(entry.path) : entry.link);
      hash.update('\0');
    });
  return hash.digest('hex');
}

function findZipEocd(bytes, label) {
  const minimumEocdSize = 22;
  const maximumCommentSize = 0xffff;
  const earliestOffset = Math.max(0, bytes.length - minimumEocdSize - maximumCommentSize);

  for (let offset = bytes.length - minimumEocdSize; offset >= earliestOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentSize = bytes.readUInt16LE(offset + 20);
    if (offset + minimumEocdSize + commentSize === bytes.length) return offset;
  }

  fail(`${label} has no valid ZIP end-of-central-directory record`);
}

function androidApkHashes(apkPath) {
  const bytes = fs.readFileSync(apkPath);
  const eocdOffset = findZipEocd(bytes, path.basename(apkPath));
  const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
  if (centralDirectoryOffset === 0xffffffff) fail('ZIP64 APK reproducibility is not supported');

  const magic = Buffer.from('APK Sig Block 42', 'ascii');
  const footerOffset = centralDirectoryOffset - 24;
  if (
    footerOffset < 0 ||
    !bytes.subarray(centralDirectoryOffset - magic.length, centralDirectoryOffset).equals(magic)
  ) {
    fail('Android release APK has no v2-compatible signing block');
  }

  const signingBlockSize = Number(bytes.readBigUInt64LE(footerOffset));
  if (!Number.isSafeInteger(signingBlockSize)) fail('Android APK signing block is too large');
  const signingBlockOffset = centralDirectoryOffset - signingBlockSize - 8;
  if (
    signingBlockOffset < 0 ||
    bytes.readBigUInt64LE(signingBlockOffset) !== BigInt(signingBlockSize)
  ) {
    fail('Android APK signing block size is inconsistent');
  }

  const normalizedOffset = Buffer.alloc(4);
  normalizedOffset.writeUInt32LE(signingBlockOffset);
  const payloadHash = crypto.createHash('sha256');
  payloadHash.update(bytes.subarray(0, signingBlockOffset));
  payloadHash.update(bytes.subarray(centralDirectoryOffset, eocdOffset + 16));
  payloadHash.update(normalizedOffset);
  payloadHash.update(bytes.subarray(eocdOffset + 20));

  return {
    artifactHash: crypto.createHash('sha256').update(bytes).digest('hex'),
    payloadHash: payloadHash.digest('hex'),
    signingBlockHash: crypto
      .createHash('sha256')
      .update(bytes.subarray(signingBlockOffset, centralDirectoryOffset))
      .digest('hex'),
  };
}

function androidBundleHashes(bundlePath) {
  const artifactHash = sha256File(bundlePath);
  return {artifactHash, payloadHash: artifactHash, signingBlockHash: null};
}

function assertHermesBytes(bytes, label) {
  if (bytes.length < hermesMagic.length || !bytes.subarray(0, hermesMagic.length).equals(hermesMagic)) {
    fail(`${label} is not optimized Hermes bytecode`);
  }
}

function assertAndroidHermes(artifactPath, format) {
  const bundlePath = format === 'aab'
    ? 'base/assets/index.android.bundle'
    : 'assets/index.android.bundle';
  const libraryPattern = format === 'aab'
    ? /^base\/lib\/(?:armeabi-v7a|arm64-v8a|x86|x86_64)\/libhermes(?:vm)?\.so$/m
    : /^lib\/(?:armeabi-v7a|arm64-v8a|x86|x86_64)\/libhermes(?:vm)?\.so$/m;
  const result = spawnSync('unzip', ['-p', artifactPath, bundlePath], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) fail(`unable to read ${bundlePath} from ${format}`);
  assertHermesBytes(result.stdout, bundlePath);

  const entries = spawnSync('unzip', ['-Z1', artifactPath], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (entries.error || entries.status !== 0) fail(`unable to list native libraries in ${format}`);
  if (!libraryPattern.test(entries.stdout)) {
    fail(`Android release ${format} is missing the Hermes runtime library`);
  }
}

function normalizeCertificateFingerprint(value) {
  return value.replace(/:/g, '').trim().toLowerCase();
}

function androidCertificateFingerprint(artifactPath, format, env) {
  if (format === 'apk') {
    const sdkRoot = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
    if (!sdkRoot) fail('ANDROID_HOME or ANDROID_SDK_ROOT is required to verify APK signing');
    const candidates = findFiles(
      path.join(sdkRoot, 'build-tools'),
      filePath => path.basename(filePath) === 'apksigner',
    ).sort();
    if (candidates.length === 0) fail('Android build-tools apksigner was not found');
    const output = captured(
      candidates[candidates.length - 1],
      ['verify', '--verbose', '--print-certs', artifactPath],
      {env},
    );
    const match = output.match(/certificate SHA-256 digest:\s*([0-9a-f]+)/i);
    if (!match) fail('unable to read APK signing certificate fingerprint');
    return normalizeCertificateFingerprint(match[1]);
  }

  const keytool = env.JAVA_HOME ? path.join(env.JAVA_HOME, 'bin', 'keytool') : 'keytool';
  const output = captured(
    keytool,
    [
      '-J-Duser.language=en',
      '-J-Duser.country=US',
      '-printcert',
      '-jarfile',
      artifactPath,
    ],
    {env},
  );
  const match = output.match(/SHA256:\s*([0-9A-F:]+)/);
  if (!match) fail('unable to read AAB signing certificate fingerprint');
  return normalizeCertificateFingerprint(match[1]);
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function javaMajor(versionOutput) {
  const match = versionOutput.match(/version "(?:1\.)?(\d+)/);
  return match ? Number(match[1]) : null;
}

function resolveJavaEnvironment(app) {
  const javaHome = process.env.RUBAN_JAVA_HOME || process.env.JAVA_HOME || null;
  const javaBinary = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
  const version = captured(javaBinary, ['-version']);
  const major = javaMajor(version);
  if (!major) fail(`unable to parse Java version: ${version}`);
  if (app.exactJavaMajor && major !== app.exactJavaMajor) {
    fail(`RN ${app.reactNative} requires JDK ${app.exactJavaMajor}; received JDK ${major}`);
  }
  if (app.minimumJavaMajor && major < app.minimumJavaMajor) {
    fail(`RN ${app.reactNative} requires JDK ${app.minimumJavaMajor}+; received JDK ${major}`);
  }
  return {
    env: javaHome ? {...process.env, JAVA_HOME: javaHome} : process.env,
    version,
    major,
  };
}

function patchFile(filePath, update) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = update(before);
  if (after !== before) fs.writeFileSync(filePath, after);
}

function prepareLegacyIos(appDir) {
  const boostPodspec = path.join(
    appDir,
    'node_modules',
    'react-native',
    'third-party-podspecs',
    'boost.podspec',
  );
  patchFile(boostPodspec, content =>
    content.replace(
      'https://boostorg.jfrog.io/artifactory/main/release/1.76.0/source/boost_1_76_0.tar.bz2',
      'https://archives.boost.io/release/1.76.0/source/boost_1_76_0.tar.bz2',
    ),
  );

  const yogaSource = path.join(
    appDir,
    'node_modules',
    'react-native',
    'ReactCommon',
    'yoga',
    'yoga',
    'Yoga.cpp',
  );
  patchFile(yogaSource, content => content.replace(/hadOverflow\(\) \|$/gm, 'hadOverflow() ||'));

  const xcodeBundleScript = path.join(appDir, 'node_modules', 'react-native', 'scripts', 'react-native-xcode.sh');
  patchFile(xcodeBundleScript, content =>
    content.replace(
      '    HBC_SOURCEMAP_FILE="$BUNDLE_FILE.map"\n',
      '    HBC_SOURCEMAP_FILE="$BUNDLE_FILE.map"\n' +
        '    if [[ ! -f "$HBC_SOURCEMAP_FILE" && -f "$DEST/main.jsbundle.map" ]]; then\n' +
        '      HBC_SOURCEMAP_FILE="$DEST/main.jsbundle.map"\n' +
        '    fi\n',
    ),
  );
}

function prepareReactNative077Ios(appDir) {
  const podspecRoot = path.join(
    appDir,
    'node_modules',
    'react-native',
    'third-party-podspecs',
  );
  const sources = [
    [
      'DoubleConversion.podspec',
      /\{ :git => double_conversion_git_url,\s*:tag => "v#\{spec\.version\}" \}/,
      'https://codeload.github.com/google/double-conversion/tar.gz/refs/tags/v1.1.6',
    ],
    [
      'RCT-Folly.podspec',
      /\{ :git => folly_git_url,\s*:tag => "v#\{folly_release_version\}" \}/,
      'https://codeload.github.com/facebook/folly/tar.gz/refs/tags/v2024.11.18.00',
    ],
    [
      'boost.podspec',
      /\{ :git => boost_git_url,\s*:tag => "v1\.84\.0" \}/,
      'https://codeload.github.com/react-native-community/boost-for-react-native/tar.gz/refs/tags/v1.84.0',
    ],
    [
      'fast_float.podspec',
      /\{\s*:git => fast_float_git_url,\s*:tag => "v6\.1\.4"\s*\}/,
      'https://codeload.github.com/fastfloat/fast_float/tar.gz/refs/tags/v6.1.4',
    ],
    [
      'fmt.podspec',
      /\{\s*:git => fmt_git_url,\s*:tag => "11\.0\.2"\s*\}/,
      'https://codeload.github.com/fmtlib/fmt/tar.gz/refs/tags/11.0.2',
    ],
    [
      'glog.podspec',
      /\{ :git => glog_git_url,\s*:tag => "v#\{spec\.version\}" \}/,
      'https://codeload.github.com/google/glog/tar.gz/refs/tags/v0.3.5',
    ],
  ];

  for (const [filename, sourcePattern, url] of sources) {
    const replacement = `{ :http => '${url}', :type => :tgz }`;
    patchFile(path.join(podspecRoot, filename), content => {
      const withCodeload = content.replace(sourcePattern, replacement);
      return withCodeload.replace(`{ :http => '${url}' }`, replacement);
    });
  }
}

function selectLatestReactNativeCore(appDir, configuration, env) {
  const podsDir = path.join(appDir, 'ios', 'Pods');
  const prebuiltDir = path.join(podsDir, 'React-Core-prebuilt');
  const switchScript = path.join(
    appDir,
    'node_modules',
    'react-native',
    'scripts',
    'replace-rncore-version.js',
  );
  const markerPath = path.join(prebuiltDir, '.last_build_configuration');
  if (!fs.existsSync(prebuiltDir) || !fs.existsSync(switchScript)) {
    fail('RN latest prebuilt iOS core is not installed');
  }

  fs.writeFileSync(markerPath, configuration === 'Debug' ? 'Release' : 'Debug');
  command(
    process.execPath,
    [
      switchScript,
      '--configuration',
      configuration,
      '--reactNativeVersion',
      '0.87.0',
      '--podsRoot',
      podsDir,
    ],
    {cwd: podsDir, env},
  );
}

function patchLegacyBoostHash(appDir) {
  const hashHeader = path.join(
    appDir,
    'ios',
    'Pods',
    'boost',
    'boost',
    'container_hash',
    'hash.hpp',
  );
  patchFile(hashHeader, content =>
    content.replace(/ : std::unary_function<T, std::size_t>/g, ''),
  );
}

function patchLegacyIosFrameworkBitcodeStrip(appDir, scheme) {
  const frameworkScript = path.join(
    appDir,
    'ios',
    'Pods',
    'Target Support Files',
    `Pods-${scheme}`,
    `Pods-${scheme}-frameworks.sh`,
  );
  patchFile(frameworkScript, content => {
    if (content.includes('.ruban-bitcode-stripped')) return content;
    const anchor = `  if [[ "$(file "$binary")" == *"dynamically linked shared library"* ]]; then
    strip_invalid_archs "$binary"
  fi
`;
    if (!content.includes(anchor)) fail('unable to patch legacy iOS framework embed script');
    return content.replace(
      anchor,
      `${anchor}
  if [[ "\${PLATFORM_NAME}" == "iphoneos" ]]; then
    if xcrun otool -l "$binary" | grep -q "segname __LLVM"; then
      local stripped_binary="\${binary}.ruban-bitcode-stripped"
      xcrun bitcode_strip "$binary" -r -o "$stripped_binary"
      mv "$stripped_binary" "$binary"
    fi
  fi
`,
    );
  });
}

function commonBuildEnvironment({appDir, app, options, cacheRoot, cacheKey, runIndex}) {
  const runSuffix = options.mode === 'release-repro' ? `run-${runIndex}` : 'shared';
  const metroRoot = path.join(
    cacheRoot,
    'metro',
    app.directory,
    options.platform,
    options.architecture,
    cacheKey,
    runSuffix,
  );
  const tmpDir = path.join(metroRoot, 'tmp');
  const workingDir = path.join(metroRoot, 'working');
  fs.mkdirSync(tmpDir, {recursive: true});
  fs.mkdirSync(workingDir, {recursive: true});

  let nodeOptions = process.env.NODE_OPTIONS || '';
  if (app.legacyOpenSsl) {
    nodeOptions = appendNodeOption(nodeOptions, '--openssl-legacy-provider');
  }

  const reactNativeDir = path.join(appDir, 'node_modules', 'react-native');
  const bundleCli = path.join(reactNativeDir, 'scripts', 'bundle.js');

  return {
    ...process.env,
    CI: '1',
    NODE_BINARY: process.execPath,
    NODE_ENV: 'production',
    NODE_OPTIONS: nodeOptions,
    RUBAN_APP_ROOT: appDir,
    RUBAN_BUNDLE_WORKING_DIR: workingDir,
    RUBAN_REACT_NATIVE_CLI: fs.existsSync(bundleCli)
      ? bundleCli
      : path.join(reactNativeDir, 'cli.js'),
    RUBAN_RELEASE_CLI: releaseCli,
    RUBAN_RELEASE_MODE: options.mode,
    TMPDIR: tmpDir,
  };
}

function ensureDirectoryLink(target, linkPath) {
  if (!fs.existsSync(target)) return;
  if (fs.existsSync(linkPath)) {
    if (fs.lstatSync(linkPath).isSymbolicLink()) {
      const currentTarget = path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
      if (currentTarget === path.resolve(target)) return;
    }
    fs.rmSync(linkPath, {recursive: true, force: true});
  }
  fs.mkdirSync(path.dirname(linkPath), {recursive: true});
  fs.symlinkSync(target, linkPath, 'dir');
}

function attachGradleDownloadMirror(gradleHome) {
  const mirrorHome = path.resolve(
    process.env.RUBAN_GRADLE_MIRROR || path.join(os.homedir(), '.gradle'),
  );
  if (!fs.existsSync(mirrorHome) || mirrorHome === path.resolve(gradleHome)) return;

  ensureDirectoryLink(
    path.join(mirrorHome, 'wrapper', 'dists'),
    path.join(gradleHome, 'wrapper', 'dists'),
  );
  ensureDirectoryLink(
    path.join(mirrorHome, 'caches', 'modules-2'),
    path.join(gradleHome, 'caches', 'modules-2'),
  );
}

function copyBuildOutput(source, destination) {
  fs.rmSync(destination, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  if (fs.statSync(source).isDirectory()) fs.cpSync(source, destination, {recursive: true});
  else fs.copyFileSync(source, destination);
}

function legacyHermesCompiler(appDir) {
  const platformDirectory =
    process.platform === 'darwin'
      ? 'osx-bin'
      : process.platform === 'linux' && process.arch === 'x64'
        ? 'linux64-bin'
        : null;
  if (!platformDirectory) fail(`RN 0.66 Hermes compiler is unsupported on ${process.platform}/${process.arch}`);
  const compiler = path.join(
    appDir,
    'node_modules',
    'hermes-engine',
    platformDirectory,
    process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
  );
  if (!fs.existsSync(compiler)) fail(`RN 0.66 Hermes compiler not found for ${platformDirectory}`);
  return compiler;
}

function prebundleLegacyAndroid(context, runIndex) {
  const {appDir, app, options, cacheRoot, cacheKey} = context;
  const runSuffix = options.mode === 'release-repro' ? `run-${runIndex}` : 'shared';
  const bundleRoot = path.join(
    cacheRoot,
    'prebundle',
    app.directory,
    options.architecture,
    cacheKey,
    runSuffix,
  );
  const assetsDir = path.join(bundleRoot, 'assets');
  const resourcesDir = path.join(bundleRoot, 'res');
  const workDir = path.join(bundleRoot, 'work');
  const bytecodeBundle = path.join(assetsDir, 'index.android.bundle');
  const sourceMapPath = path.join(bundleRoot, 'index.android.bundle.map');

  if (options.mode !== 'release-fast') {
    fs.rmSync(bundleRoot, {recursive: true, force: true});
  }
  if (fs.existsSync(bytecodeBundle) && fs.existsSync(sourceMapPath)) {
    assertHermesBytes(fs.readFileSync(bytecodeBundle), 'cached RN 0.66 prebundle');
    return {assetsDir, resourcesDir, sourceMapPath};
  }

  fs.mkdirSync(assetsDir, {recursive: true});
  fs.mkdirSync(resourcesDir, {recursive: true});
  fs.mkdirSync(workDir, {recursive: true});
  const plainBundle = path.join(workDir, 'index.android.bundle.js');
  const packagerMap = path.join(workDir, 'index.android.bundle.packager.map');
  const hermesBundle = path.join(workDir, 'index.android.bundle.hbc');
  const compilerMap = `${hermesBundle}.map`;
  const env = commonBuildEnvironment({...context, runIndex});

  console.log(`gongshu-package: Metro/Hermes prebundle ${app.directory}/${options.mode}`);
  command(
    process.execPath,
    [
      releaseCli,
      'bundle',
      '--platform',
      'android',
      '--dev',
      'false',
      '--entry-file',
      'index.js',
      '--bundle-output',
      plainBundle,
      '--assets-dest',
      resourcesDir,
      '--sourcemap-output',
      packagerMap,
      '--minify',
      'false',
    ],
    {cwd: appDir, env},
  );
  command(legacyHermesCompiler(appDir), [
    '-emit-binary',
    '-out',
    hermesBundle,
    plainBundle,
    '-O',
    '-output-source-map',
  ]);
  command(process.execPath, [
    path.join(appDir, 'node_modules', 'react-native', 'scripts', 'compose-source-maps.js'),
    packagerMap,
    compilerMap,
    '-o',
    sourceMapPath,
  ]);
  copyBuildOutput(hermesBundle, bytecodeBundle);
  assertHermesBytes(fs.readFileSync(bytecodeBundle), 'RN 0.66 prebundle');
  return {assetsDir, resourcesDir, sourceMapPath};
}

function buildAndroidOnce(context, runIndex, captureRoot) {
  const {era, appDir, app, options, cacheRoot, nativeKey, java, version, buildNumber} = context;
  const androidDir = path.join(appDir, 'android');
  const gradleHome = path.join(
    cacheRoot,
    options.mode === 'release-repro' ? 'gradle-repro' : 'gradle',
    app.directory,
    options.architecture,
    nativeKey,
    options.mode === 'release-repro' ? `run-${runIndex}` : 'shared',
  );
  fs.mkdirSync(gradleHome, {recursive: true});
  attachGradleDownloadMirror(gradleHome);

  const legacyPrebundle = era === '0.66' ? prebundleLegacyAndroid(context, runIndex) : null;

  const env = {
    ...java.env,
    ...commonBuildEnvironment({...context, runIndex}),
    GRADLE_USER_HOME: gradleHome,
    RUBAN_ANDROID_RELEASE_SIGNING: options.androidDistribution,
    ...(legacyPrebundle
      ? {
          RUBAN_PREBUNDLED_ASSETS_DIR: legacyPrebundle.assetsDir,
          RUBAN_PREBUNDLED_RES_DIR: legacyPrebundle.resourcesDir,
        }
      : {}),
  };
  const args = ['--console=plain', '--stacktrace'];
  if (options.mode === 'release-fast') args.push('--build-cache');
  else args.push('--no-build-cache', '--no-configuration-cache', '--rerun-tasks', 'clean');
  if (app.architectures.length > 1 || app.directory === 'gongshu-latest') {
    args.push(`-PnewArchEnabled=${options.architecture === 'new'}`);
  }
  const buildType = options.lane === 'regression' ? 'Regression' : 'Release';
  const buildTypeLower = buildType.toLowerCase();
  const artifactFormat = options.androidDistribution === 'play' ? 'aab' : 'apk';
  args.push(`-PRUBAN_VERSION_NAME=${version}`);
  if (buildNumber) args.push(`-PRUBAN_VERSION_CODE=${buildNumber}`);
  args.push(`:app:${artifactFormat === 'aab' ? 'bundle' : 'assemble'}${buildType}`);

  console.log(
    `gongshu-package: Android ${app.directory}/${options.architecture}/${options.mode} run ${runIndex}`,
  );
  command('./gradlew', args, {cwd: androidDir, env});

  const artifactCandidates = findFiles(
    path.join(
      androidDir,
      'app',
      'build',
      'outputs',
      artifactFormat === 'aab' ? 'bundle' : 'apk',
      buildTypeLower,
    ),
    filePath => filePath.endsWith(`.${artifactFormat}`),
  );
  if (artifactCandidates.length !== 1) {
    fail(`expected one release ${artifactFormat}, found ${artifactCandidates.length}`);
  }
  assertAndroidHermes(artifactCandidates[0], artifactFormat);

  const sourceMapCandidates = legacyPrebundle
    ? [legacyPrebundle.sourceMapPath]
    : findFiles(
        path.join(androidDir, 'app', 'build'),
        filePath => filePath.endsWith('.map') && filePath.toLowerCase().includes(buildTypeLower),
      ).sort((left, right) => {
        const leftScore = left.includes('index.android.bundle') ? 0 : 1;
        const rightScore = right.includes('index.android.bundle') ? 0 : 1;
        return leftScore - rightScore || left.localeCompare(right);
      });
  if (sourceMapCandidates.length === 0 || !fs.existsSync(sourceMapCandidates[0])) {
    fail('Android release source map was not produced');
  }

  const capturedArtifact = path.join(captureRoot, `run-${runIndex}.${artifactFormat}`);
  const capturedSourceMap = path.join(captureRoot, `run-${runIndex}.map`);
  copyBuildOutput(artifactCandidates[0], capturedArtifact);
  copyBuildOutput(sourceMapCandidates[0], capturedSourceMap);
  const artifactHashes = artifactFormat === 'apk'
    ? androidApkHashes(capturedArtifact)
    : androidBundleHashes(capturedArtifact);
  const certificateSha256 = androidCertificateFingerprint(capturedArtifact, artifactFormat, env);
  const certificateVariable = options.androidDistribution === 'website'
    ? 'RUBAN_ANDROID_APP_SIGNING_CERT_SHA256'
    : 'RUBAN_ANDROID_UPLOAD_CERT_SHA256';
  const expectedCertificateSha256 = normalizeCertificateFingerprint(env[certificateVariable] || '');
  if (!expectedCertificateSha256) fail(`${certificateVariable} is required`);
  if (certificateSha256 !== expectedCertificateSha256) {
    fail(`Android ${options.androidDistribution} signing certificate does not match its policy`);
  }
  return {
    artifactPath: capturedArtifact,
    sourceMapPath: capturedSourceMap,
    ...artifactHashes,
    certificateSha256,
    sourceMapHash: sha256File(capturedSourceMap),
    gradleDistribution: fs
      .readFileSync(path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties'), 'utf8')
      .match(/^distributionUrl=(.+)$/m)?.[1]
      ?.replace(/\\:/g, ':'),
  };
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function iosSigningFor(app, options) {
  if (options.iosDistribution === 'ad-hoc') return app.iosAdHoc?.[options.lane];
  if (options.iosDistribution === 'app-store') return app.iosAppStore;
  return null;
}

function installIosIpa(ipaPath, device, expectedAppId) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-ios-install-'));
  fs.chmodSync(temporaryRoot, 0o700);
  try {
    command('ditto', ['-x', '-k', ipaPath, temporaryRoot]);
    const payloadRoot = path.join(temporaryRoot, 'Payload');
    const appBundles = fs.existsSync(payloadRoot)
      ? fs
          .readdirSync(payloadRoot, {withFileTypes: true})
          .filter(entry => entry.isDirectory() && entry.name.endsWith('.app'))
          .map(entry => path.join(payloadRoot, entry.name))
      : [];
    if (appBundles.length !== 1) fail(`expected one installable app, found ${appBundles.length}`);
    const bundleId = captured('plutil', [
      '-extract',
      'CFBundleIdentifier',
      'raw',
      path.join(appBundles[0], 'Info.plist'),
    ]);
    if (bundleId !== expectedAppId) fail(`installable app identifier mismatch: ${bundleId}`);
    command('xcrun', [
      'devicectl',
      'device',
      'install',
      'app',
      '--device',
      device,
      '--timeout',
      '120',
      appBundles[0],
    ]);
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

function writeIosExportOptions(filePath, app, options) {
  const appId = app.appIds[options.lane];
  const signing = iosSigningFor(app, options);
  if (!signing) fail(`missing signing policy for ${options.iosDistribution}`);
  const exportMethod = options.iosDistribution === 'app-store'
    ? 'app-store-connect'
    : 'release-testing';
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>destination</key>
  <string>export</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
  <key>method</key>
  <string>${exportMethod}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${xmlEscape(appId)}</key>
    <string>${xmlEscape(signing.profile)}</string>
  </dict>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>teamID</key>
  <string>${xmlEscape(signing.teamId)}</string>
</dict>
</plist>
`;
  fs.writeFileSync(filePath, contents);
}

function provisioningProfileName(profilePath) {
  const decoded = spawnSync('security', ['cms', '-D', '-i', profilePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (decoded.error || decoded.status !== 0) fail('unable to decode embedded provisioning profile');
  const extracted = spawnSync('plutil', ['-extract', 'Name', 'raw', '-o', '-', '-'], {
    input: decoded.stdout,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (extracted.error || extracted.status !== 0) fail('unable to read provisioning profile name');
  return extracted.stdout.trim();
}

function inspectSignedIosIpa(ipaPath, app, options, inspectionRoot) {
  fs.rmSync(inspectionRoot, {recursive: true, force: true});
  fs.mkdirSync(inspectionRoot, {recursive: true});
  command('ditto', ['-x', '-k', ipaPath, inspectionRoot]);
  const payloadDir = path.join(inspectionRoot, 'Payload');
  const appBundles = fs.existsSync(payloadDir)
    ? fs
        .readdirSync(payloadDir, {withFileTypes: true})
        .filter(entry => entry.isDirectory() && entry.name.endsWith('.app'))
        .map(entry => path.join(payloadDir, entry.name))
    : [];
  if (appBundles.length !== 1) fail(`expected one signed app in IPA, found ${appBundles.length}`);
  const appBundle = appBundles[0];
  command('codesign', ['--verify', '--deep', '--strict', appBundle]);
  const bundleId = captured('plutil', [
    '-extract',
    'CFBundleIdentifier',
    'raw',
    path.join(appBundle, 'Info.plist'),
  ]);
  if (bundleId !== app.appIds[options.lane]) {
    fail(`signed IPA bundle identifier mismatch: ${bundleId}`);
  }
  const embeddedProfile = path.join(appBundle, 'embedded.mobileprovision');
  if (!fs.existsSync(embeddedProfile)) fail('signed IPA has no embedded provisioning profile');
  const profileName = provisioningProfileName(embeddedProfile);
  const signing = iosSigningFor(app, options);
  if (!signing || profileName !== signing.profile) {
    fail(`signed IPA provisioning profile mismatch: ${profileName}`);
  }
  return appBundle;
}

function buildIosOnce(context, runIndex, captureRoot) {
  const {era, appDir, app, options, cacheRoot, nativeKey, version, buildNumber} = context;
  const iosDir = path.join(appDir, 'ios');
  const iosHome = path.join(cacheRoot, 'ios-home');
  const derivedData = path.join(
    cacheRoot,
    options.mode === 'release-repro' ? 'xcode-repro' : 'xcode-derived-data',
    app.directory,
    options.architecture,
    nativeKey,
    options.mode === 'release-repro' ? `run-${runIndex}` : 'shared',
  );
  const sourceMapPath = path.join(captureRoot, `run-${runIndex}.map`);
  const env = {
    ...commonBuildEnvironment({...context, runIndex}),
    HOME: options.iosDistribution === 'simulator' ? iosHome : os.homedir(),
    CLI_PATH: releaseCli,
    CP_HOME_DIR: path.join(cacheRoot, 'cocoapods', app.directory, nativeKey),
    RCT_NEW_ARCH_ENABLED: options.architecture === 'new' ? '1' : '0',
    RUBYOPT: appendNodeOption(process.env.RUBYOPT, '-rlogger'),
    SOURCEMAP_FILE: sourceMapPath,
  };
  if (era === '0.66') env.NO_FLIPPER = '1';

  if (era === '0.66') prepareLegacyIos(appDir);
  if (era === '0.77') prepareReactNative077Ios(appDir);
  fs.mkdirSync(path.join(iosHome, 'Library', 'Caches', 'ReactNative'), {recursive: true});
  if (options.iosDistribution !== 'simulator') {
    ensureDirectoryLink(
      path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles'),
      path.join(iosHome, 'Library', 'MobileDevice', 'Provisioning Profiles'),
    );
  }
  fs.mkdirSync(env.CP_HOME_DIR, {recursive: true});
  console.log(`gongshu-package: CocoaPods ${app.directory}/${options.architecture}`);
  command('bundle', ['exec', 'ruby', resolveCocoaPodsScript(), 'install'], {
    cwd: iosDir,
    env: cocoaPodsEnvironment({...env, COCOAPODS_NO_BUNDLER: '1'}),
  });
  if (era === '0.66') {
    patchLegacyBoostHash(appDir);
    if (options.iosDistribution === 'ad-hoc') {
      patchLegacyIosFrameworkBitcodeStrip(appDir, app.scheme);
    }
  }

  const configuration = options.lane === 'regression' ? 'Regression' : 'Release';
  const scheme = options.lane === 'regression' ? `${app.scheme}Regression` : app.scheme;
  const isSigned = options.iosDistribution !== 'simulator';
  const archivePath = path.join(derivedData, 'Archives', `run-${runIndex}.xcarchive`);
  const args = [
    '-workspace',
    `${app.scheme}.xcworkspace`,
    '-scheme',
    scheme,
    '-configuration',
    configuration,
    '-sdk',
    isSigned ? 'iphoneos' : 'iphonesimulator',
    '-destination',
    isSigned ? 'generic/platform=iOS' : 'generic/platform=iOS Simulator',
    '-derivedDataPath',
    derivedData,
  ];
  if (isSigned) args.push('-archivePath', archivePath);
  if (options.mode !== 'release-fast') args.push('clean');
  args.push(
    isSigned ? 'archive' : 'build',
    'COMPILER_INDEX_STORE_ENABLE=NO',
    `MARKETING_VERSION=${version}`,
  );
  if (buildNumber) args.push(`CURRENT_PROJECT_VERSION=${buildNumber}`);
  if (isSigned && env.RUBAN_IOS_SIGNING_KEYCHAIN) {
    args.push(`OTHER_CODE_SIGN_FLAGS=--keychain ${env.RUBAN_IOS_SIGNING_KEYCHAIN}`);
  }
  if (!isSigned) args.push('CODE_SIGNING_ALLOWED=NO');

  console.log(
    `gongshu-package: iOS ${app.directory}/${options.architecture}/${options.mode} run ${runIndex}`,
  );
  if (era === 'latest') selectLatestReactNativeCore(appDir, 'Release', env);
  const buildResult = command('xcodebuild', args, {cwd: iosDir, env, allowFailure: true});
  if (era === 'latest') selectLatestReactNativeCore(appDir, 'Debug', env);
  if (buildResult.status !== 0) {
    fail(`xcodebuild ${args.join(' ')} exited with ${buildResult.status}`);
  }

  let capturedArtifact;
  let appBundle;
  if (isSigned) {
    const exportOptionsPath = path.join(captureRoot, `export-options-${runIndex}.plist`);
    const exportPath = path.join(captureRoot, `export-${runIndex}`);
    writeIosExportOptions(exportOptionsPath, app, options);
    fs.rmSync(exportPath, {recursive: true, force: true});
    command('xcodebuild', [
      '-exportArchive',
      '-archivePath',
      archivePath,
      '-exportPath',
      exportPath,
      '-exportOptionsPlist',
      exportOptionsPath,
    ], {cwd: iosDir, env});
    const ipaCandidates = findFiles(exportPath, filePath => filePath.endsWith('.ipa'));
    if (ipaCandidates.length !== 1) fail(`expected one exported IPA, found ${ipaCandidates.length}`);
    capturedArtifact = path.join(captureRoot, `run-${runIndex}.ipa`);
    copyBuildOutput(ipaCandidates[0], capturedArtifact);
    appBundle = inspectSignedIosIpa(
      capturedArtifact,
      app,
      options,
      path.join(captureRoot, `inspect-${runIndex}`),
    );
  } else {
    appBundle = path.join(
      derivedData,
      'Build',
      'Products',
      `${configuration}-iphonesimulator`,
      `${app.scheme}.app`,
    );
    capturedArtifact = path.join(captureRoot, `run-${runIndex}.app`);
  }
  if (!fs.existsSync(appBundle)) fail(`iOS release app not found: ${app.scheme}.app`);
  const builtVersion = captured('plutil', [
    '-extract',
    'CFBundleShortVersionString',
    'raw',
    path.join(appBundle, 'Info.plist'),
  ]);
  if (builtVersion !== version) {
    fail(`iOS marketing version mismatch: expected ${version}, found ${builtVersion}`);
  }
  const mainBundle = path.join(appBundle, 'main.jsbundle');
  if (!fs.existsSync(mainBundle)) fail('iOS main.jsbundle was not produced');
  assertHermesBytes(fs.readFileSync(mainBundle), 'main.jsbundle');

  if (!fs.existsSync(sourceMapPath)) {
    const sourceMapCandidates = findFiles(
      derivedData,
      filePath => filePath.endsWith('.map') && filePath.includes(configuration),
    );
    if (sourceMapCandidates.length === 0) fail('iOS release source map was not produced');
    copyBuildOutput(sourceMapCandidates[0], sourceMapPath);
  }

  if (!isSigned) copyBuildOutput(appBundle, capturedArtifact);
  const artifactHash = isSigned ? sha256File(capturedArtifact) : sha256Tree(capturedArtifact);
  return {
    artifactPath: capturedArtifact,
    sourceMapPath,
    artifactHash,
    payloadHash: artifactHash,
    signingBlockHash: null,
    sourceMapHash: sha256File(sourceMapPath),
    xcode: captured('xcodebuild', ['-version']),
  };
}

function writeManifest(context, buildResults, finalArtifact, finalSourceMap, reproducibility) {
  const {app, options, cacheKey, nativeKey, outputDir, java, version, buildNumber} = context;
  const gitCommit = captured('git', ['rev-parse', 'HEAD']);
  const dirty = captured('git', ['status', '--porcelain', '--untracked-files=all']).length > 0;
  const first = buildResults[0];
  const manifest = {
    schemaVersion: 1,
    commit: gitCommit,
    dirty,
    app: app.directory,
    version,
    buildNumber,
    reactNative: app.reactNative,
    platform: options.platform,
    lane: options.lane,
    appId: app.appIds[options.lane],
    architecture: options.architecture,
    mode: options.mode,
    androidDistribution: options.platform === 'android' ? options.androidDistribution : null,
    iosDistribution: options.platform === 'ios' ? options.iosDistribution : null,
    hermes: {
      enabled: true,
      bytecodeVerified: true,
      runtimeVerified: false,
    },
    worker: {
      status: 'unprobed',
      substrate: null,
      parityFixture: 'missing',
    },
    nativeFixture: 'missing',
    toolchains: {
      node: process.version,
      java: java ? java.version.split('\n')[0] : null,
      gradleDistribution: first.gradleDistribution || null,
      xcode: first.xcode || null,
    },
    cacheKeys: {
      input: cacheKey,
      metro: cacheKey,
      native: nativeKey,
    },
    signingClass:
      options.platform === 'android'
        ? {
            internal: 'internal-distribution',
            website: 'app-signing',
            play: 'upload',
          }[options.androidDistribution]
        : options.iosDistribution === 'ad-hoc'
          ? 'ad-hoc'
          : options.iosDistribution === 'app-store'
            ? 'app-store'
          : 'simulator-unsigned',
    signingCertificateSha256: first.certificateSha256 || null,
    artifact: relativePath(finalArtifact),
    sourceMap: relativePath(finalSourceMap),
    artifactSha256: first.artifactHash,
    sourceMapSha256: first.sourceMapHash,
    reproducibility:
      options.mode === 'release-repro'
        ? {
            runs: 2,
            ...reproducibility,
            rawArtifactHashes: buildResults.map(result => result.artifactHash),
            payloadHashes: buildResults.map(result => result.payloadHash),
            signingBlockHashes: buildResults.map(result => result.signingBlockHash),
            sourceMapHashes: buildResults.map(result => result.sourceMapHash),
          }
        : null,
    createdAt: new Date().toISOString(),
  };
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`gongshu-package: manifest ${relativePath(manifestPath)}`);
  return manifestPath;
}

const options = parseOptions(process.argv.slice(2));
const {era, app} = validateOptions(options);
const appDir = path.join(repoRoot, 'apps', app.directory);
const version = readAppVersion(appDir);
const buildNumber = readBuildNumber();
const cacheRoot = path.resolve(
  process.env.RUBAN_BUILD_CACHE_ROOT || path.join(repoRoot, '.cache', 'release'),
);
ensureExternalCacheRoot(cacheRoot);

if (!fs.existsSync(path.join(appDir, 'node_modules', 'react-native', 'cli.js'))) {
  fail(`${app.directory} dependencies are not installed`);
}

if (options.sync && !options.dryRun) {
  command(process.execPath, [
    'scripts/dev/sync-gongshu.mjs',
    '--app',
    app.directory,
    '--native-platform',
    options.platform,
  ]);
}

const cacheKey = inputKey(appDir, options, app);
const nativeKey = nativeCacheKey(appDir, options, app);
const outputDir = path.join(
  repoRoot,
  'artifacts',
  app.directory,
  options.platform,
  options.lane,
  options.architecture,
  options.mode,
  cacheKey,
);

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        app: app.directory,
        version,
        buildNumber,
        reactNative: app.reactNative,
        platform: options.platform,
        lane: options.lane,
        appId: app.appIds[options.lane],
        architecture: options.architecture,
        mode: options.mode,
        androidDistribution: options.platform === 'android' ? options.androidDistribution : null,
        iosDistribution: options.platform === 'ios' ? options.iosDistribution : null,
        cacheKey,
        nativeCacheKey: nativeKey,
        cacheRoot,
        outputDir,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

fs.mkdirSync(cacheRoot, {recursive: true});
fs.rmSync(outputDir, {recursive: true, force: true});
fs.mkdirSync(outputDir, {recursive: true});
const captureRoot = path.join(outputDir, 'runs');
fs.mkdirSync(captureRoot, {recursive: true});
const java = options.platform === 'android' ? resolveJavaEnvironment(app) : null;
const context = {
  era,
  app,
  appDir,
  options,
  cacheRoot,
  cacheKey,
  nativeKey,
  outputDir,
  java,
  version,
  buildNumber,
};
const runCount = options.mode === 'release-repro' ? 2 : 1;
const buildResults = [];

for (let runIndex = 1; runIndex <= runCount; runIndex += 1) {
  buildResults.push(
    options.platform === 'android'
      ? buildAndroidOnce(context, runIndex, captureRoot)
      : buildIosOnce(context, runIndex, captureRoot),
  );
}

const reproducibility = {
  verified:
    buildResults.length === 1 ||
    buildResults.every(
      result =>
        result.payloadHash === buildResults[0].payloadHash &&
        result.sourceMapHash === buildResults[0].sourceMapHash,
    ),
  rawArtifactVerified:
    buildResults.length === 1 ||
    buildResults.every(result => result.artifactHash === buildResults[0].artifactHash),
  payloadVerified:
    buildResults.length === 1 ||
    buildResults.every(result => result.payloadHash === buildResults[0].payloadHash),
  sourceMapVerified:
    buildResults.length === 1 ||
    buildResults.every(result => result.sourceMapHash === buildResults[0].sourceMapHash),
};
const extension = options.platform === 'android'
  ? options.androidDistribution === 'play' ? 'aab' : 'apk'
  : options.iosDistribution === 'simulator' ? 'app' : 'ipa';
const distributionSuffix = options.platform === 'android'
  ? `-${options.androidDistribution}`
  : `-${options.iosDistribution}`;
const finalArtifact = path.join(
  outputDir,
  `ruban-${era}-${options.platform}-${options.lane}-${options.architecture}${distributionSuffix}-${options.mode}.${extension}`,
);
const finalSourceMap = path.join(outputDir, 'source-map.map');
copyBuildOutput(buildResults[0].artifactPath, finalArtifact);
copyBuildOutput(buildResults[0].sourceMapPath, finalSourceMap);
const manifestPath = writeManifest(
  context,
  buildResults,
  finalArtifact,
  finalSourceMap,
  reproducibility,
);

if (!reproducibility.verified) {
  fail(`release-repro content mismatch; inspect ${relativePath(manifestPath)}`);
}

if (options.device) {
  console.log(`gongshu-package: installing ${relativePath(finalArtifact)} on ${options.device}`);
  if (options.platform === 'android') {
    command('adb', ['-s', options.device, 'install', '-r', finalArtifact]);
  } else {
    installIosIpa(finalArtifact, options.device, app.appIds[options.lane]);
  }
  command(process.execPath, [
    releaseHealth,
    '--platform',
    options.platform,
    '--era',
    era,
    '--device',
    options.device,
    '--arch',
    options.architecture,
    '--app-id',
    app.appIds[options.lane],
    '--manifest',
    manifestPath,
  ]);
}

console.log(`gongshu-package: PASS ${relativePath(finalArtifact)}`);
