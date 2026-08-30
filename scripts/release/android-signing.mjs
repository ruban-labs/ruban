#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const account = 'ruban-labs';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const keys = [
  {
    id: 'app-signing',
    file: 'ruban-app-signing.p12',
    alias: 'ruban-app-signing',
    prefix: 'RUBAN_ANDROID_APP_SIGNING',
    purpose: 'Formal website package and Google Play app-signing master key',
  },
  {
    id: 'upload',
    file: 'ruban-upload.p12',
    alias: 'ruban-upload',
    prefix: 'RUBAN_ANDROID_UPLOAD',
    purpose: 'Google Play uploads, regression, and Gongshu sample distribution',
  },
];

function fail(message) {
  console.error(`android-signing: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    input: options.input,
    stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    if (!options.sensitive) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
    }
    fail(`${command} exited with ${result.status}`);
  }
  return result;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function resolveKeytool() {
  const configuredHome = process.env.RUBAN_JAVA_HOME || process.env.JAVA_HOME;
  const javaHome = configuredHome || run('/usr/libexec/java_home', ['-v', '17']).stdout.trim();
  const keytool = path.join(javaHome, 'bin', 'keytool');
  if (!fs.existsSync(keytool)) fail(`keytool not found below ${javaHome}`);
  return keytool;
}

function keychainService(key, kind) {
  return `ruban.android.${key.id}.${kind}-password`;
}

function resolveKeychainHelper() {
  const source = path.join(repoRoot, 'scripts', 'release', 'keychain-secret.swift');
  const helper = path.join(repoRoot, '.cache', 'toolchains', 'ruban-keychain-secret');
  if (
    !fs.existsSync(helper) ||
    fs.statSync(helper).mtimeMs < fs.statSync(source).mtimeMs
  ) {
    fs.mkdirSync(path.dirname(helper), {recursive: true});
    run('xcrun', ['swiftc', source, '-o', helper]);
    fs.chmodSync(helper, 0o700);
  }
  return helper;
}

function saveKeychainPassword(service, password) {
  run(
    resolveKeychainHelper(),
    ['set', account, service],
    {input: password, sensitive: true},
  );
}

function loadKeychainPassword(service) {
  return run(
    resolveKeychainHelper(),
    ['get', account, service],
    {sensitive: true},
  ).stdout;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function certificateFingerprint(keytool, filePath, alias, password) {
  const result = run(
    keytool,
    [
      '-J-Duser.language=en',
      '-J-Duser.country=US',
      '-list',
      '-v',
      '-storetype',
      'PKCS12',
      '-keystore',
      filePath,
      '-alias',
      alias,
      '-storepass:env',
      'RUBAN_BOOTSTRAP_PASSWORD',
    ],
    {env: {...process.env, RUBAN_BOOTSTRAP_PASSWORD: password}, sensitive: true},
  );
  const match = result.stdout.match(/SHA256:\s*([0-9A-F:]+)/);
  if (!match) fail(`unable to read certificate fingerprint for ${alias}`);
  return match[1].replace(/:/g, '').toLowerCase();
}

function bootstrap(outputRoot) {
  const normalizedRoot = path.resolve(outputRoot);
  const keystoreRoot = path.join(normalizedRoot, 'keystores');
  const metadataPath = path.join(normalizedRoot, 'metadata.json');
  if (fs.existsSync(metadataPath) || fs.existsSync(keystoreRoot)) {
    fail(`refusing to overwrite an existing signing repository at ${normalizedRoot}`);
  }
  fs.mkdirSync(keystoreRoot, {recursive: true, mode: 0o700});
  const keytool = resolveKeytool();
  const metadata = [];

  for (const key of keys) {
    const password = crypto.randomBytes(32).toString('base64url');
    const filePath = path.join(keystoreRoot, key.file);
    run(
      keytool,
      [
        '-J-Duser.language=en',
        '-J-Duser.country=US',
        '-genkeypair',
        '-storetype',
        'PKCS12',
        '-keystore',
        filePath,
        '-alias',
        key.alias,
        '-keyalg',
        'RSA',
        '-keysize',
        '4096',
        '-sigalg',
        'SHA256withRSA',
        '-validity',
        '10000',
        '-dname',
        'CN=Ruban Labs,O=Ruban Labs,C=CN',
        '-storepass:env',
        'RUBAN_BOOTSTRAP_PASSWORD',
        '-keypass:env',
        'RUBAN_BOOTSTRAP_PASSWORD',
      ],
      {env: {...process.env, RUBAN_BOOTSTRAP_PASSWORD: password}, sensitive: true},
    );
    fs.chmodSync(filePath, 0o600);
    saveKeychainPassword(keychainService(key, 'store'), password);
    saveKeychainPassword(keychainService(key, 'key'), password);
    metadata.push({
      id: key.id,
      file: `keystores/${key.file}`,
      format: 'PKCS12',
      alias: key.alias,
      purpose: key.purpose,
      sha256: sha256File(filePath),
      certificateSha256: certificateFingerprint(keytool, filePath, key.alias, password),
    });
  }

  fs.writeFileSync(
    metadataPath,
    `${JSON.stringify({schemaVersion: 1, generatedAt: new Date().toISOString(), keys: metadata}, null, 2)}\n`,
    {mode: 0o644},
  );
  console.log(`android-signing: created ${metadata.length} encrypted keystores`);
}

function signingEnvironment(keystoreRoot) {
  const env = {...process.env};
  const keytool = resolveKeytool();
  for (const key of keys) {
    const storeFile = path.join(keystoreRoot, key.file);
    const storePassword = loadKeychainPassword(keychainService(key, 'store'));
    env[`${key.prefix}_STORE_FILE`] = storeFile;
    env[`${key.prefix}_STORE_PASSWORD`] = storePassword;
    env[`${key.prefix}_KEY_ALIAS`] = key.alias;
    env[`${key.prefix}_KEY_PASSWORD`] = loadKeychainPassword(keychainService(key, 'key'));
    env[`${key.prefix}_CERT_SHA256`] = certificateFingerprint(
      keytool,
      storeFile,
      key.alias,
      storePassword,
    );
  }
  return env;
}

function runWithSigning(keystoreRoot) {
  const separator = process.argv.indexOf('--');
  if (separator === -1 || !process.argv[separator + 1]) fail('run requires -- <command> [args]');
  const command = process.argv[separator + 1];
  const args = process.argv.slice(separator + 2);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: signingEnvironment(path.resolve(keystoreRoot)),
    stdio: 'inherit',
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  process.exit(result.status === null ? 1 : result.status);
}

const command = process.argv[2];
if (command === 'bootstrap') {
  const outputRoot = option('--output-root');
  if (!outputRoot) fail('bootstrap requires --output-root <directory>');
  bootstrap(outputRoot);
} else if (command === 'run') {
  const keystoreRoot = option('--keystore-root');
  if (!keystoreRoot) fail('run requires --keystore-root <directory>');
  runWithSigning(keystoreRoot);
} else {
  fail('expected bootstrap or run');
}
