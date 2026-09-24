import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {resolveSiteEnvironment} from '../../website/site-environment.mjs';
import {planSiteDeployment} from './deployment.mjs';
import {prepareSiteArtifact, validateSiteFiles} from './prepare.mjs';

const source = {
  repository: 'ruban-labs/ruban',
  eventName: 'workflow_dispatch',
  ref: 'refs/heads/feat/site',
  environment: 'preview',
};

test('preview and production have distinct fixed repositories and domains', () => {
  assert.equal(
    planSiteDeployment(source).repository,
    'ruban-labs/mobile-site-preview'
  );
  assert.equal(
    planSiteDeployment({
      ...source,
      ref: 'refs/heads/main',
      environment: 'production',
    }).repository,
    'ruban-labs/mobile-site'
  );
  assert.equal(resolveSiteEnvironment().preview, false);
  assert.equal(
    resolveSiteEnvironment('preview').url,
    'https://mobile-preview.ruban-labs.work/'
  );
  assert.match(resolveSiteEnvironment('preview').robots, /Disallow: \//);
  assert.match(resolveSiteEnvironment('production').robots, /Allow: \//);
  for (const environment of ['', 'staging', 'constructor', '__proto__']) {
    assert.throws(
      () => resolveSiteEnvironment(environment),
      /must be production or preview/
    );
  }
});

test('production is main-only and preview requires explicit manual publication', () => {
  assert.equal(
    planSiteDeployment({
      ...source,
      ref: 'refs/heads/main',
      environment: 'production',
      eventName: 'push',
    }).name,
    'production'
  );
  for (const override of [
    {environment: undefined},
    {environment: 'production'},
    {eventName: 'push'},
    {eventName: 'pull_request'},
    {eventName: 'pull_request_target'},
    {repository: 'someone/ruban'},
    {ref: 'refs/tags/v1'},
    {ref: 'refs/pull/1/merge'},
    {ref: 'refs/heads/'},
    {ref: 'refs/heads/topic\ninjected=value'},
  ]) {
    assert.throws(() => planSiteDeployment({...source, ...override}));
  }
});

async function fixture(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ruban-site-'));
  context.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(path.join(root, '_astro'));
  await writeFile(path.join(root, 'index.html'), '<h1>Ruban</h1>');
  await writeFile(path.join(root, '_astro/site.css'), 'body {}');
  return root;
}

test('artifact receipt, CNAME and Jekyll opt-out follow the selected environment', async (context) => {
  const root = await fixture(context);
  for (const environment of ['preview', 'production']) {
    const site = resolveSiteEnvironment(environment);
    const receipt = await prepareSiteArtifact({
      root,
      environment,
      sourceSha: 'a'.repeat(40),
      runId: '123',
    });
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, 'deployment.json'), 'utf8')),
      receipt
    );
    assert.deepEqual(Object.keys(receipt).sort(), [
      'environment',
      'repository',
      'runId',
      'schemaVersion',
      'sourceRepository',
      'sourceSha',
      'url',
    ]);
    assert.equal(
      await readFile(path.join(root, 'CNAME'), 'utf8'),
      `${site.host}\n`
    );
    assert.equal(await readFile(path.join(root, '.nojekyll'), 'utf8'), '');
    await validateSiteFiles(root);
  }
  await assert.rejects(
    prepareSiteArtifact({
      root,
      environment: 'preview',
      sourceSha: 'main',
      runId: '123',
    })
  );
  await assert.rejects(
    prepareSiteArtifact({
      root,
      environment: 'preview',
      sourceSha: 'a'.repeat(40),
      runId: '../123',
    })
  );
});

test('source, secrets, hidden directories and symlinks cannot enter the static artifact', async (context) => {
  const root = await fixture(context);
  for (const name of [
    '.env',
    'private.pem',
    'index.html.map',
    'app.ts',
    'app.js',
    'package.json',
    '_astro/.private.css',
  ]) {
    const file = path.join(root, name);
    await writeFile(file, 'synthetic fixture');
    await assert.rejects(
      validateSiteFiles(root),
      /Unexpected website artifact/
    );
    await rm(file);
  }
  await mkdir(path.join(root, '.private'));
  await assert.rejects(validateSiteFiles(root), /Unexpected website artifact/);
  await rm(path.join(root, '.private'), {recursive: true});
  await symlink(path.join(root, 'index.html'), path.join(root, 'linked.html'));
  await assert.rejects(validateSiteFiles(root), /Unexpected website artifact/);
});
