import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {prepareWebsiteRelease, websiteReleaseMetadata} from './website-release.mjs';

const commit = 'a'.repeat(40);
const manifest = {
  schemaVersion: 1, platform: 'android', app: 'gongshu-latest', lane: 'production',
  androidDistribution: 'website', signingClass: 'app-signing', architecture: 'new',
  mode: 'release-clean', hermes: {enabled: true, bytecodeVerified: true}, commit,
  version: '0.0.1', buildNumber: '50', appId: 'com.rubanlabs.mobile',
  signingCertificateSha256: 'b'.repeat(64), artifactSha256: 'c'.repeat(64),
  sourceMap: '/private/source.map', toolchains: {privatePath: '/private/signing'},
};

test('public metadata allowlists identity and fingerprints, not build internals', () => {
  const result = websiteReleaseMetadata(manifest, commit, '50');
  assert.equal(result.tag, 'mobile-v0.0.1-b50');
  assert.equal(result.prerelease, true);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('rejects wrong channel, lane, commit, build, engine and missing signature', () => {
  for (const change of [
    {androidDistribution: 'play'}, {lane: 'debug'}, {commit: 'd'.repeat(40)}, {mode: 'release-fast'},
    {buildNumber: '49'}, {signingCertificateSha256: null}, {hermes: {enabled: false}},
    {appId: 'com.rubanlabs.mobile.regression'}, {version: '1.0.0\ninvalid'},
  ]) assert.throws(() => websiteReleaseMetadata({...manifest, ...change}, commit, '50'));
});

test('export verifies bytes and includes only APK, checksum and public receipt', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ruban-release-'));
  try {
    const artifact = path.join(root, 'signed.apk');
    const manifestPath = path.join(root, 'manifest.json');
    const output = path.join(root, 'public');
    writeFileSync(artifact, 'synthetic test package');
    writeFileSync(manifestPath, JSON.stringify({...manifest, artifact,
      artifactSha256: createHash('sha256').update(readFileSync(artifact)).digest('hex')}));
    const result = prepareWebsiteRelease(manifestPath, output, commit, '50');
    assert.deepEqual(readdirSync(output).sort(), ['SHA256SUMS', 'release.json', result.file].sort());
    assert.throws(() => prepareWebsiteRelease(manifestPath, output, commit, '50'));
    writeFileSync(artifact, 'changed');
    assert.throws(() => prepareWebsiteRelease(manifestPath, path.join(root, 'tampered'), commit, '50'), /digest/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});
