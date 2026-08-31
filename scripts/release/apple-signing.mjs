#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const account = 'ruban-labs';
const matchPasswordService = 'ruban.apple.match-password';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const identityPolicies = {
  development: {
    certificate: 'development.certificate.cer',
    certificatePem: 'development.certificate.pem',
    privateKey: 'development.key.pem',
  },
  distribution: {
    certificate: 'distribution.certificate.cer',
    certificatePem: 'distribution.certificate.pem',
    privateKey: 'distribution.key.pem',
  },
};
const profilePolicies = [
  {
    name: 'Ruban Mobile Debug Development',
    file: 'ruban-mobile-debug-development.mobileprovision',
    type: 'development',
    certificate: 'development',
  },
  {
    name: 'Ruban Gongshu Samples Development',
    file: 'ruban-gongshu-samples-development.mobileprovision',
    type: 'development',
    certificate: 'development',
  },
  {
    name: 'Ruban Mobile Production Ad Hoc',
    file: 'ruban-mobile-production-ad-hoc.mobileprovision',
    type: 'adhoc',
    certificate: 'distribution',
  },
  {
    name: 'Ruban Mobile Regression Ad Hoc',
    file: 'ruban-mobile-regression-ad-hoc.mobileprovision',
    type: 'adhoc',
    certificate: 'distribution',
  },
  {
    name: 'Ruban Gongshu Samples Ad Hoc',
    file: 'ruban-gongshu-samples-ad-hoc.mobileprovision',
    type: 'adhoc',
    certificate: 'distribution',
  },
  {
    name: 'Ruban Mobile App Store',
    file: 'ruban-mobile-app-store.mobileprovision',
    type: 'appstore',
    certificate: 'distribution',
  },
];

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    input: options.input,
    stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
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

function resolveKeychainHelper() {
  const source = path.join(repoRoot, 'scripts', 'release', 'keychain-secret.swift');
  const helper = path.join(repoRoot, '.cache', 'toolchains', 'ruban-keychain-secret');
  if (!fs.existsSync(helper) || fs.statSync(helper).mtimeMs < fs.statSync(source).mtimeMs) {
    fs.mkdirSync(path.dirname(helper), {recursive: true});
    run('xcrun', ['swiftc', source, '-o', helper]);
    fs.chmodSync(helper, 0o700);
  }
  return helper;
}

function loadMatchPassword() {
  if (process.env.RUBAN_MATCH_PASSWORD) return process.env.RUBAN_MATCH_PASSWORD;
  return run(resolveKeychainHelper(), ['get', account, matchPasswordService], {
    sensitive: true,
  }).stdout;
}

function signingEnvironment(extra = {}) {
  const inherited = {...process.env};
  delete inherited.MATCH_GIT_BASIC_AUTHORIZATION;
  delete inherited.MATCH_GIT_BEARER_AUTHORIZATION;
  delete inherited.MATCH_GIT_PRIVATE_KEY;
  delete inherited.GIT_CONFIG_COUNT;
  for (const name of Object.keys(inherited)) {
    if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(name)) delete inherited[name];
  }
  const env = {
    ...inherited,
    BUNDLE_PATH: path.join(repoRoot, '.cache', 'toolchains', 'bundle'),
    FASTLANE_OPT_OUT_USAGE: '1',
    FASTLANE_SKIP_UPDATE_CHECK: '1',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_TERMINAL_PROMPT: '0',
    MATCH_PASSWORD: loadMatchPassword(),
    ...extra,
  };
  return env;
}

function ensureFile(filePath) {
  if (!fs.statSync(filePath, {throwIfNoEntry: false})?.isFile()) fail(`missing file ${filePath}`);
  return filePath;
}

function prepareIdentityMaterials(materialRoot, temporaryRoot) {
  const identities = {};
  for (const [kind, policy] of Object.entries(identityPolicies)) {
    const certificatePath = ensureFile(path.join(materialRoot, policy.certificate));
    const certificatePemPath = ensureFile(path.join(materialRoot, policy.certificatePem));
    const privateKeyPath = ensureFile(path.join(materialRoot, policy.privateKey));
    const matchIdentityPath = path.join(temporaryRoot, `${kind}.p12`);
    run('openssl', [
      'pkcs12',
      '-export',
      '-in',
      certificatePemPath,
      '-inkey',
      privateKeyPath,
      '-out',
      matchIdentityPath,
      '-passout',
      'pass:',
      '-name',
      `Ruban ${kind}`,
    ], {sensitive: true});
    fs.chmodSync(matchIdentityPath, 0o600);
    run('openssl', [
      'pkcs12',
      '-in',
      matchIdentityPath,
      '-noout',
      '-passin',
      'pass:',
    ], {sensitive: true});
    identities[kind] = {certificatePath, identityPath: matchIdentityPath};
  }
  return identities;
}

function provisioningProfileName(profilePath) {
  const decoded = run('security', ['cms', '-D', '-i', profilePath], {sensitive: true}).stdout;
  return run('plutil', ['-extract', 'Name', 'raw', '-o', '-', '-'], {
    input: decoded,
    sensitive: true,
  }).stdout.trim();
}

function resolveProfiles(materialRoot) {
  const profiles = new Map();
  for (const policy of profilePolicies) {
    const profilePath = ensureFile(path.join(materialRoot, policy.file));
    const actualName = provisioningProfileName(profilePath);
    if (actualName !== policy.name) {
      fail(`profile name mismatch for ${policy.file}: ${actualName}`);
    }
    profiles.set(policy.name, profilePath);
  }
  return profiles;
}

function withPreparedMaterials(materialRoot, callback) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-match-import-'));
  fs.chmodSync(temporaryRoot, 0o700);
  try {
    const identities = prepareIdentityMaterials(materialRoot, temporaryRoot);
    const profiles = resolveProfiles(materialRoot);
    return callback({identities, profiles});
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

function bootstrapMatch(materialRoot, ascKeyPath) {
  withPreparedMaterials(materialRoot, ({identities, profiles}) => {
    const env = signingEnvironment({RUBAN_ASC_KEY_PATH: ascKeyPath});
    for (const policy of profilePolicies) {
      const identity = identities[policy.certificate];
      run(
        'bundle',
        [
          'exec',
          'ruby',
          'scripts/release/match-import.rb',
          '--type',
          policy.type,
          '--certificate',
          identity.certificatePath,
          '--private-key',
          identity.identityPath,
          '--profile',
          profiles.get(policy.name),
        ],
        {cwd: repoRoot, env, inherit: true, sensitive: true},
      );
    }
  });
  console.log(`apple-signing: imported ${profilePolicies.length} profiles into Match`);
}

function inspectLocalSigning(materialRoot) {
  withPreparedMaterials(materialRoot, () => {});
  console.log(`apple-signing: verified 2 identities and ${profilePolicies.length} profiles`);
}

function runWithSigning() {
  const separator = process.argv.indexOf('--');
  if (separator === -1 || !process.argv[separator + 1]) fail('run requires -- <command> [args]');
  const command = process.argv[separator + 1];
  const args = process.argv.slice(separator + 2);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: signingEnvironment(),
    stdio: 'inherit',
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  process.exit(result.status === null ? 1 : result.status);
}

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    input: options.input,
    stdio: options.inherit ? 'inherit' : [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (!options.sensitive) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
    }
    throw new Error(`${command} exited with ${result.status}`);
  }
  return result;
}

function parseKeychainList(output) {
  return String(output || '')
    .split('\n')
    .map(line => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function importWwdrCertificates(keychainPath, temporaryRoot) {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Keychains', 'login.keychain-db'),
    '/Library/Keychains/System.keychain',
    '/System/Library/Keychains/SystemRootCertificates.keychain',
  ].filter(candidate => fs.existsSync(candidate));
  const certificates = new Set();
  for (const candidate of candidates) {
    const result = spawnSync('security', [
      'find-certificate',
      '-a',
      '-c',
      'Apple Worldwide Developer Relations',
      '-p',
      candidate,
    ], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) continue;
    const matches = result.stdout.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    ) || [];
    matches.forEach(certificate => certificates.add(certificate));
  }
  if (certificates.size === 0) {
    throw new Error('no Apple WWDR certificate is available on this runner');
  }
  [...certificates].forEach((certificate, index) => {
    const certificatePath = path.join(temporaryRoot, `wwdr-${index}.pem`);
    fs.writeFileSync(certificatePath, `${certificate}\n`, {mode: 0o600});
    checked('security', ['import', certificatePath, '-k', keychainPath], {sensitive: true});
  });
}

function filesBelow(root, predicate) {
  const matches = [];
  const visit = current => {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && predicate(child)) matches.push(child);
    }
  };
  visit(root);
  return matches;
}

function decryptMatchRepository(repositoryPath, env) {
  const fastlaneRoot = checked('bundle', ['show', 'fastlane'], {
    cwd: repoRoot,
    env,
    sensitive: true,
  }).stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!fastlaneRoot || !fs.existsSync(fastlaneRoot)) {
    throw new Error('the bundled Fastlane gem is unavailable');
  }
  checked('bundle', [
    'exec',
    'ruby',
    '-rbundler/setup',
    '-I',
    path.join(fastlaneRoot, 'fastlane', 'lib'),
    '-I',
    path.join(fastlaneRoot, 'fastlane_core', 'lib'),
    '-I',
    path.join(fastlaneRoot, 'match', 'lib'),
    '-rfastlane',
    '-rmatch/encryption/openssl',
    '-e',
    'Match::Encryption::OpenSSL.new(working_directory: ARGV.fetch(0)).decrypt_files',
    repositoryPath,
  ], {cwd: repoRoot, env, inherit: true, sensitive: true});
}

function importMatchIdentity(
  repositoryPath,
  certificateType,
  keychainPath,
  temporaryRoot,
  identityPassword,
) {
  const identityRoot = path.join(repositoryPath, 'certs', certificateType);
  const identities = filesBelow(identityRoot, filePath => filePath.endsWith('.p12'));
  if (identities.length !== 1) {
    throw new Error(`expected one Match ${certificateType} identity, found ${identities.length}`);
  }

  const compatibleP12 = path.join(temporaryRoot, `${certificateType}-identity-legacy.p12`);
  checked('bundle', [
    'exec',
    'ruby',
    'scripts/release/repack-pkcs12.rb',
    identities[0],
    compatibleP12,
    `Ruban ${certificateType} identity`,
  ], {cwd: repoRoot, input: identityPassword, sensitive: true});
  checked('security', [
    'import',
    compatibleP12,
    '-k',
    keychainPath,
    '-P',
    identityPassword,
    '-T',
    '/usr/bin/codesign',
    '-T',
    '/usr/bin/security',
  ], {sensitive: true});
}

function installSigningProfiles(repositoryPath) {
  const profileRoot = path.join(repositoryPath, 'profiles');
  const expectedNames = new Set(profilePolicies.map(policy => policy.name));
  const profiles = filesBelow(profileRoot, filePath => filePath.endsWith('.mobileprovision'));
  const profilesDirectory = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
  fs.mkdirSync(profilesDirectory, {recursive: true});
  const installed = [];
  const foundNames = new Set();
  for (const profile of profiles) {
    const name = provisioningProfileName(profile);
    if (!expectedNames.has(name)) continue;
    const decoded = checked('security', ['cms', '-D', '-i', profile], {sensitive: true}).stdout;
    const uuid = checked('plutil', ['-extract', 'UUID', 'raw', '-o', '-', '-'], {
      input: decoded,
      sensitive: true,
    }).stdout.trim();
    const destination = path.join(profilesDirectory, `${uuid}.mobileprovision`);
    fs.copyFileSync(profile, destination);
    installed.push(destination);
    foundNames.add(name);
  }
  const missingNames = [...expectedNames].filter(name => !foundNames.has(name));
  if (missingNames.length > 0) {
    installed.forEach(filePath => fs.rmSync(filePath, {force: true}));
    throw new Error(`Match repository is missing profiles: ${missingNames.join(', ')}`);
  }
  return installed;
}

function resolveGithubTooling() {
  const workspaceLocalRoot = process.env.RAY_WORKSPACE_LOCAL_ROOT;
  if (!workspaceLocalRoot || !path.isAbsolute(workspaceLocalRoot)) {
    throw new Error('RAY_WORKSPACE_LOCAL_ROOT is required for scoped GitHub authentication');
  }
  const workspaceRoot = path.dirname(workspaceLocalRoot);
  const rayGh = path.join(workspaceRoot, 'scripts', 'ray-gh.mjs');
  const projectPath = path.join(
    workspaceRoot,
    '.workspace-local',
    'project-workspaces',
    'github.com',
    'ruban-labs',
    'ruban',
  );
  return {rayGh, projectPath};
}

function resolveGithubToken(rayGh, projectPath) {
  const token = checked(process.execPath, [
    rayGh,
    '--project',
    projectPath,
    '--identity',
    'ruban',
    '--purpose',
    'maintenance',
    '--profile',
    'github-ruban-labs-maintainer',
    '--',
    'auth',
    'token',
  ], {cwd: repoRoot, sensitive: true}).stdout.trim();
  if (!token) throw new Error('scoped GitHub token is unavailable');
  return token;
}

function runWithIsolatedSigning() {
  const separator = process.argv.indexOf('--');
  if (separator === -1 || !process.argv[separator + 1]) {
    fail('run-isolated requires -- <command> [args]');
  }

  const command = process.argv[separator + 1];
  const args = process.argv.slice(separator + 2);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-app-store-signing-'));
  fs.chmodSync(temporaryRoot, 0o700);
  const keychainPath = path.join(temporaryRoot, 'build.keychain-db');
  const providedRepositoryPath = process.env.RUBAN_APPLE_CERTS_PATH
    ? path.resolve(process.env.RUBAN_APPLE_CERTS_PATH)
    : null;
  const matchRepositoryPath = providedRepositoryPath || path.join(temporaryRoot, 'apple-certs');
  const keychainPassword = crypto.randomBytes(32).toString('base64url');
  const originalKeychains = parseKeychainList(
    checked('security', ['list-keychains', '-d', 'user']).stdout,
  );
  let installedProfiles = [];
  let exitCode = 1;

  try {
    let githubToken = null;
    if (providedRepositoryPath) {
      if (!fs.statSync(providedRepositoryPath, {throwIfNoEntry: false})?.isDirectory()) {
        throw new Error('RUBAN_APPLE_CERTS_PATH must name a checked-out Match repository');
      }
    } else {
      const {rayGh, projectPath} = resolveGithubTooling();
      const githubCloneEnv = {
        ...process.env,
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: 'http.https://github.com.proxy',
        GIT_CONFIG_VALUE_0: 'http://127.0.0.1:17890',
        GIT_CONFIG_KEY_1: 'http.version',
        GIT_CONFIG_VALUE_1: 'HTTP/1.1',
        GIT_TERMINAL_PROMPT: '0',
      };
      checked(process.execPath, [
        rayGh,
        '--project',
        projectPath,
        '--identity',
        'ruban',
        '--purpose',
        'maintenance',
        '--profile',
        'github-ruban-labs-maintainer',
        '--',
        'repo',
        'clone',
        'ruban-labs/apple-certs',
        matchRepositoryPath,
      ], {cwd: repoRoot, env: githubCloneEnv, inherit: true});
      githubToken = resolveGithubToken(rayGh, projectPath);
    }
    checked('security', ['create-keychain', '-p', keychainPassword, keychainPath], {
      sensitive: true,
    });
    checked('security', ['set-keychain-settings', '-lut', '21600', keychainPath]);
    checked('security', ['unlock-keychain', '-p', keychainPassword, keychainPath], {
      sensitive: true,
    });
    checked('security', ['list-keychains', '-d', 'user', '-s', keychainPath, ...originalKeychains]);
    importWwdrCertificates(keychainPath, temporaryRoot);

    const env = signingEnvironment({
      MATCH_GIT_URL: 'https://github.com/ruban-labs/apple-certs.git',
      ...(githubToken
        ? {
            MATCH_GIT_BASIC_AUTHORIZATION: Buffer.from(
              `x-access-token:${githubToken}`,
            ).toString('base64'),
          }
        : {}),
      MATCH_KEYCHAIN_NAME: keychainPath,
      MATCH_KEYCHAIN_PASSWORD: keychainPassword,
      MATCH_SKIP_SET_PARTITION_LIST: 'true',
      RUBAN_IOS_SIGNING_KEYCHAIN: keychainPath,
    });
    decryptMatchRepository(matchRepositoryPath, env);
    importMatchIdentity(
      matchRepositoryPath,
      'development',
      keychainPath,
      temporaryRoot,
      keychainPassword,
    );
    importMatchIdentity(
      matchRepositoryPath,
      'distribution',
      keychainPath,
      temporaryRoot,
      keychainPassword,
    );
    installedProfiles = installSigningProfiles(matchRepositoryPath);
    checked('security', [
      'set-key-partition-list',
      '-S',
      'apple-tool:,apple:',
      '-s',
      '-k',
      keychainPassword,
      keychainPath,
    ], {sensitive: true});

    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    exitCode = result.status === null ? 1 : result.status;
  } catch (error) {
    console.error(`apple-signing: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    installedProfiles.forEach(filePath => fs.rmSync(filePath, {force: true}));
    spawnSync('security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains], {
      stdio: 'ignore',
    });
    spawnSync('security', ['delete-keychain', keychainPath], {stdio: 'ignore'});
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }

  process.exit(exitCode);
}

try {
  const command = process.argv[2];
  if (command === 'check') {
    loadMatchPassword();
    console.log('apple-signing: Match password is available');
  } else if (command === 'inspect-local') {
    const materialRoot = option('--material-root');
    if (!materialRoot) fail('inspect-local requires --material-root');
    inspectLocalSigning(path.resolve(materialRoot));
  } else if (command === 'bootstrap-match') {
    const materialRoot = option('--material-root');
    const ascKeyPath = option('--asc-key');
    if (!materialRoot || !ascKeyPath) {
      fail('bootstrap-match requires --material-root and --asc-key');
    }
    bootstrapMatch(path.resolve(materialRoot), path.resolve(ascKeyPath));
  } else if (command === 'run') {
    runWithSigning();
  } else if (command === 'run-isolated' || command === 'run-app-store') {
    runWithIsolatedSigning();
  } else {
    fail('expected check, inspect-local, bootstrap-match, run, run-isolated, or run-app-store');
  }
} catch (error) {
  console.error(`apple-signing: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
