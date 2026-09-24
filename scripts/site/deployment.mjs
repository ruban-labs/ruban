import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolveSiteEnvironment} from '../../website/site-environment.mjs';

export function planSiteDeployment({environment, eventName, ref, repository}) {
  if (environment === undefined)
    throw new Error('An explicit website environment is required');
  const site = resolveSiteEnvironment(environment);
  if (repository !== 'ruban-labs/ruban') {
    throw new Error('Only ruban-labs/ruban may publish the website');
  }
  if (!['push', 'workflow_dispatch'].includes(eventName)) {
    throw new Error(
      'Website publication requires a main push or manual dispatch'
    );
  }
  if (
    typeof ref !== 'string' ||
    !/^refs\/heads\/.+/.test(ref) ||
    /[\r\n]/.test(ref)
  ) {
    throw new Error('Website publication requires a branch');
  }
  if (site.name === 'production' && ref !== 'refs/heads/main') {
    throw new Error('Production website publication requires main');
  }
  if (eventName === 'push' && (site.preview || ref !== 'refs/heads/main')) {
    throw new Error('Only production main pushes publish automatically');
  }
  return site;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const site = planSiteDeployment({
    environment: process.env.RUBAN_SITE_ENV,
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
  await appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `environment=${site.name}`,
      `repository=${site.repository}`,
      `repository_name=${site.repositoryName}`,
      `host=${site.host}`,
      `url=${site.url}`,
      '',
    ].join('\n')
  );
  console.log(`Website destination: ${site.repository} (${site.url})`);
}
