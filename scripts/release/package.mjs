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
    legacyOpenSsl: true,
    exactJavaMajor: 17,
  },
  '0.76': {
    aliases: ['0.76', 'gongshu-0.76'],
    directory: 'gongshu-0.76',
    reactNative: '0.76.9',
    architectures: ['old', 'new'],
    scheme: 'gongshu076',
    appIds: {
      production: 'com.rubanlabs.mobile.gongshu.rn076',
      regression: 'com.rubanlabs.mobile.gongshu.rn076.regression',
      debug: 'com.rubanlabs.mobile.gongshu.rn076.debug',
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
    minimumJavaMajor: 17,
  },
};

function fail(message, exitCode = 1) {
  console.error(`gongshu-package: ${message}`);
  process.exit(exitCode);
}

function usage() {
  console.log(`usage:
  node scripts/release/package.mjs \\
    --app <0.66|0.76|latest> \\
    --platform <android|ios> \\
    [--lane <production|regression>] \\
    [--arch <old|new>] \\
    [--mode <release-fast|release-clean|release-repro>] \\
    [--device <android-serial>] [--skip-sync] [--dry-run]

Examples:
  pnpm gongshu:package --app 0.66 --platform android --lane regression --mode release-fast
  pnpm gongshu:package --app 0.76 --platform android --lane production --arch old --mode release-clean
  pnpm gongshu:package --app latest --platform ios --mode release-repro`);
}

function parseOptions(argv) {
  const options = {
    app: null,
    platform: null,
    architecture: null,
    lane: 'production',
    mode: 'release-fast',
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
  if (!resolvedApp) fail('expected --app <0.66|0.76|latest>', 2);
  if (!platforms.includes(options.platform)) fail('expected --platform <android|ios>', 2);
  if (!lanes.includes(options.lane)) fail('expected --lane <production|regression>', 2);
  if (!modes.includes(options.mode)) {
    fail('expected --mode <release-fast|release-clean|release-repro>', 2);
  }

  const [era, app] = resolvedApp;
  if (!options.architecture && app.architectures.length === 1) {
    options.architecture = app.architectures[0];
  }
  if (!app.architectures.includes(options.architecture)) {
    fail(`${era} supports architecture cells: ${app.architectures.join(', ')}`, 2);
  }
  if (options.platform === 'ios' && options.device) {
    fail('--device runtime verification currently supports Android only', 2);
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
  collectFiles(path.join(repoRoot, 'packages', 'react-native-progress'), files);
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

function assertHermesBytes(bytes, label) {
  if (bytes.length < hermesMagic.length || !bytes.subarray(0, hermesMagic.length).equals(hermesMagic)) {
    fail(`${label} is not optimized Hermes bytecode`);
  }
}

function assertAndroidHermes(apkPath) {
  const result = spawnSync('unzip', ['-p', apkPath, 'assets/index.android.bundle'], {
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) fail('unable to read assets/index.android.bundle from APK');
  assertHermesBytes(result.stdout, 'assets/index.android.bundle');

  const entries = spawnSync('unzip', ['-Z1', apkPath], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (entries.error || entries.status !== 0) fail('unable to list native libraries in APK');
  if (!/^lib\/(?:armeabi-v7a|arm64-v8a|x86|x86_64)\/libhermes\.so$/m.test(entries.stdout)) {
    fail('Android release APK is missing the Hermes runtime library');
  }
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

function prepareReactNative076Ios(appDir) {
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
      'https://codeload.github.com/facebook/folly/tar.gz/refs/tags/v2024.10.14.00',
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
  const {era, appDir, app, options, cacheRoot, nativeKey, java} = context;
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
  args.push(`:app:assemble${buildType}`);

  console.log(
    `gongshu-package: Android ${app.directory}/${options.architecture}/${options.mode} run ${runIndex}`,
  );
  command('./gradlew', args, {cwd: androidDir, env});

  const apkCandidates = findFiles(
    path.join(androidDir, 'app', 'build', 'outputs', 'apk', buildTypeLower),
    filePath => filePath.endsWith('.apk'),
  );
  if (apkCandidates.length !== 1) {
    fail(`expected one release APK, found ${apkCandidates.length}`);
  }
  assertAndroidHermes(apkCandidates[0]);

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

  const capturedArtifact = path.join(captureRoot, `run-${runIndex}.apk`);
  const capturedSourceMap = path.join(captureRoot, `run-${runIndex}.map`);
  copyBuildOutput(apkCandidates[0], capturedArtifact);
  copyBuildOutput(sourceMapCandidates[0], capturedSourceMap);
  const apkHashes = androidApkHashes(capturedArtifact);
  return {
    artifactPath: capturedArtifact,
    sourceMapPath: capturedSourceMap,
    ...apkHashes,
    sourceMapHash: sha256File(capturedSourceMap),
    gradleDistribution: fs
      .readFileSync(path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties'), 'utf8')
      .match(/^distributionUrl=(.+)$/m)?.[1]
      ?.replace(/\\:/g, ':'),
  };
}

function buildIosOnce(context, runIndex, captureRoot) {
  const {era, appDir, app, options, cacheRoot, nativeKey} = context;
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
    HOME: iosHome,
    CLI_PATH: releaseCli,
    CP_HOME_DIR: path.join(cacheRoot, 'cocoapods', app.directory, nativeKey),
    RCT_NEW_ARCH_ENABLED: options.architecture === 'new' ? '1' : '0',
    SOURCEMAP_FILE: sourceMapPath,
  };
  if (era === '0.66') env.NO_FLIPPER = '1';

  if (era === '0.66') prepareLegacyIos(appDir);
  if (era === '0.76') prepareReactNative076Ios(appDir);
  fs.mkdirSync(path.join(iosHome, 'Library', 'Caches', 'ReactNative'), {recursive: true});
  fs.mkdirSync(env.CP_HOME_DIR, {recursive: true});
  console.log(`gongshu-package: CocoaPods ${app.directory}/${options.architecture}`);
  command('pod', ['install'], {cwd: iosDir, env});
  if (era === '0.66') patchLegacyBoostHash(appDir);

  const configuration = options.lane === 'regression' ? 'Regression' : 'Release';
  const scheme = options.lane === 'regression' ? `${app.scheme}Regression` : app.scheme;
  const args = [
    '-workspace',
    `${app.scheme}.xcworkspace`,
    '-scheme',
    scheme,
    '-configuration',
    configuration,
    '-sdk',
    'iphonesimulator',
    '-destination',
    'generic/platform=iOS Simulator',
    '-derivedDataPath',
    derivedData,
  ];
  if (options.mode !== 'release-fast') args.push('clean');
  args.push('build', 'CODE_SIGNING_ALLOWED=NO', 'COMPILER_INDEX_STORE_ENABLE=NO');

  console.log(
    `gongshu-package: iOS ${app.directory}/${options.architecture}/${options.mode} run ${runIndex}`,
  );
  if (era === 'latest') selectLatestReactNativeCore(appDir, 'Release', env);
  const buildResult = command('xcodebuild', args, {cwd: iosDir, env, allowFailure: true});
  if (era === 'latest') selectLatestReactNativeCore(appDir, 'Debug', env);
  if (buildResult.status !== 0) {
    fail(`xcodebuild ${args.join(' ')} exited with ${buildResult.status}`);
  }

  const appBundle = path.join(
    derivedData,
    'Build',
    'Products',
    `${configuration}-iphonesimulator`,
    `${app.scheme}.app`,
  );
  if (!fs.existsSync(appBundle)) fail(`iOS release app not found: ${app.scheme}.app`);
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

  const capturedArtifact = path.join(captureRoot, `run-${runIndex}.app`);
  copyBuildOutput(appBundle, capturedArtifact);
  return {
    artifactPath: capturedArtifact,
    sourceMapPath,
    artifactHash: sha256Tree(capturedArtifact),
    payloadHash: sha256Tree(capturedArtifact),
    signingBlockHash: null,
    sourceMapHash: sha256File(sourceMapPath),
    xcode: captured('xcodebuild', ['-version']),
  };
}

function writeManifest(context, buildResults, finalArtifact, finalSourceMap, reproducibility) {
  const {app, options, cacheKey, nativeKey, outputDir, java} = context;
  const gitCommit = captured('git', ['rev-parse', 'HEAD']);
  const dirty = captured('git', ['status', '--porcelain', '--untracked-files=all']).length > 0;
  const first = buildResults[0];
  const manifest = {
    schemaVersion: 1,
    commit: gitCommit,
    dirty,
    app: app.directory,
    reactNative: app.reactNative,
    platform: options.platform,
    lane: options.lane,
    appId: app.appIds[options.lane],
    architecture: options.architecture,
    mode: options.mode,
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
    signingClass: options.platform === 'android' ? 'development' : 'simulator-unsigned',
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
const cacheRoot = path.resolve(
  process.env.RUBAN_BUILD_CACHE_ROOT || path.join(repoRoot, '.cache', 'release'),
);
ensureExternalCacheRoot(cacheRoot);

if (!fs.existsSync(path.join(appDir, 'node_modules', 'react-native', 'cli.js'))) {
  fail(`${app.directory} dependencies are not installed`);
}

if (options.sync && !options.dryRun) {
  command(process.execPath, ['scripts/dev/sync-gongshu.mjs', '--app', app.directory]);
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
        reactNative: app.reactNative,
        platform: options.platform,
        lane: options.lane,
        appId: app.appIds[options.lane],
        architecture: options.architecture,
        mode: options.mode,
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
const context = {era, app, appDir, options, cacheRoot, cacheKey, nativeKey, outputDir, java};
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
const extension = options.platform === 'android' ? 'apk' : 'app';
const finalArtifact = path.join(
  outputDir,
  `ruban-${era}-${options.platform}-${options.lane}-${options.architecture}-${options.mode}.${extension}`,
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
  command('adb', ['-s', options.device, 'install', '-r', finalArtifact]);
  command(process.execPath, [
    releaseHealth,
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
