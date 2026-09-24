import {lstat, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolveSiteEnvironment} from '../../website/site-environment.mjs';

export async function validateSiteFiles(root, relativeDirectory = '') {
  const directory = path.join(root, relativeDirectory);
  const stats = await lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error('Website artifact must contain only ordinary directories');
  }
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = path.posix.join(relativeDirectory, entry.name);
    const metadata = [
      'CNAME',
      '.nojekyll',
      'deployment.json',
      'robots.txt',
    ].includes(relative);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await validateSiteFiles(root, relative);
    } else if (
      !entry.isFile() ||
      (!metadata &&
        (entry.name.startsWith('.') ||
          !/\.(?:html|css|svg|png|jpe?g|webp|ico|woff2?)$/.test(entry.name)))
    ) {
      throw new Error(`Unexpected website artifact: ${relative}`);
    }
  }
}

export async function prepareSiteArtifact({
  root,
  environment,
  sourceSha,
  runId,
}) {
  const site = resolveSiteEnvironment(environment);
  if (
    !/^[a-f0-9]{40}$/.test(sourceSha ?? '') ||
    !/^[1-9][0-9]*$/.test(runId ?? '')
  ) {
    throw new Error(
      'Website artifact requires an exact source SHA and Actions run ID'
    );
  }
  await validateSiteFiles(root);
  const receipt = {
    schemaVersion: 1,
    environment: site.name,
    sourceRepository: 'ruban-labs/ruban',
    sourceSha,
    runId,
    repository: site.repository,
    url: site.url,
  };
  await writeFile(path.join(root, 'CNAME'), `${site.host}\n`);
  await writeFile(path.join(root, '.nojekyll'), '');
  await writeFile(
    path.join(root, 'deployment.json'),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
  return receipt;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = fileURLToPath(new URL('../../website/dist/', import.meta.url));
  const receipt = await prepareSiteArtifact({
    root,
    environment: process.env.RUBAN_SITE_ENV,
    sourceSha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
  });
  console.log(
    `Prepared static artifact for ${receipt.repository} from ${receipt.sourceSha}`
  );
}
