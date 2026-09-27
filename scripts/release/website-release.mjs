import {createHash} from 'node:crypto';
import {appendFileSync, copyFileSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function websiteReleaseMetadata(manifest, commit, buildNumber) {
  if (manifest.schemaVersion !== 1 || manifest.platform !== 'android' ||
      manifest.app !== 'gongshu-latest' || manifest.lane !== 'production' ||
      manifest.androidDistribution !== 'website' || manifest.signingClass !== 'app-signing' ||
      manifest.architecture !== 'new' || !['release-clean', 'release-repro'].includes(manifest.mode) ||
      manifest.hermes?.enabled !== true || manifest.hermes?.bytecodeVerified !== true) {
    throw new Error('Only a signed Hermes Android website production package can be published');
  }
  if (!/^[0-9a-f]{40}$/.test(commit) || manifest.commit !== commit ||
      !/^[1-9][0-9]{0,9}$/.test(buildNumber) || Number(buildNumber) > 2100000000 ||
      manifest.buildNumber !== buildNumber || !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
      manifest.appId !== 'com.rubanlabs.mobile') {
    throw new Error('Release identity does not match the workflow');
  }
  if (!/^[0-9a-f]{64}$/i.test(manifest.signingCertificateSha256) ||
      !/^[0-9a-f]{64}$/.test(manifest.artifactSha256)) {
    throw new Error('Verified signing and artifact fingerprints are required');
  }
  return {
    schemaVersion: 1,
    tag: `mobile-v${manifest.version}-b${buildNumber}`,
    file: `ruban-${manifest.version}-${buildNumber}-android.apk`,
    version: manifest.version,
    buildNumber,
    commit,
    buildMode: manifest.mode,
    sourceDirty: manifest.dirty === true,
    appId: manifest.appId,
    distribution: 'website',
    prerelease: true,
    sha256: manifest.artifactSha256,
    signingCertificateSha256: manifest.signingCertificateSha256,
  };
}

export function prepareWebsiteRelease(manifestPath, outputDir, commit, buildNumber) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const metadata = websiteReleaseMetadata(manifest, commit, buildNumber);
  const artifact = path.resolve(manifest.artifact);
  const productRoot = `${realpathSync(path.dirname(manifestPath))}${path.sep}`;
  if (!realpathSync(artifact).startsWith(productRoot) || !lstatSync(artifact).isFile() || !artifact.endsWith('.apk')) {
    throw new Error('APK must be a regular file inside the package output');
  }
  const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
  if (sha256 !== metadata.sha256) throw new Error('APK digest differs from the verified package');
  mkdirSync(outputDir, {recursive: false});
  copyFileSync(artifact, path.join(outputDir, metadata.file));
  writeFileSync(path.join(outputDir, 'SHA256SUMS'), `${sha256}  ${metadata.file}\n`);
  writeFileSync(path.join(outputDir, 'release.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const metadata = prepareWebsiteRelease(process.argv[2], process.argv[3], process.env.GITHUB_SHA, process.env.GITHUB_RUN_NUMBER);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${metadata.tag}\n`);
  console.log(`Prepared ${metadata.tag}`);
}
