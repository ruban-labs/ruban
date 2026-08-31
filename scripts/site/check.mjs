import {access, lstat, readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '../..');
const outputRoot = path.join(repositoryRoot, 'website/dist');
const pages = [
  path.join(outputRoot, 'index.html'),
  path.join(outputRoot, 'privacy/index.html'),
];

const requiredFiles = [
  ...pages,
  path.join(outputRoot, 'robots.txt'),
];

for (const file of requiredFiles) await access(file);

async function assertNoSymlinks(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const entryPath = path.join(directory, entry.name);
    const stats = await lstat(entryPath);
    if (stats.isSymbolicLink()) throw new Error(`${path.relative(outputRoot, entryPath)} must not be a symlink`);
    if (stats.isDirectory()) await assertNoSymlinks(entryPath);
  }
}

await assertNoSymlinks(outputRoot);

for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const relativeName = path.relative(outputRoot, page);
  const h1Count = (html.match(/<h1(?:\s|>)/g) ?? []).length;
  if (h1Count !== 1) throw new Error(`${relativeName} must contain exactly one h1`);
  if (!html.includes('name="viewport"')) throw new Error(`${relativeName} is missing viewport metadata`);
  if (!html.includes('name="description"')) throw new Error(`${relativeName} is missing a description`);
  if (/<script\b/i.test(html)) throw new Error(`${relativeName} must remain script-free`);
  if (/\b(?:href|src|action)="http:\/\//i.test(html)) throw new Error(`${relativeName} contains an insecure external URL`);
  if (!/<link rel="icon" href="data:image\/svg\+xml,/i.test(html)) throw new Error(`${relativeName} is missing the Ruban favicon`);
  if (!/<img [^>]*alt="Ruban"/i.test(html)) throw new Error(`${relativeName} is missing the Ruban lockup`);

  const stylesheetHref = html.match(/<link rel="stylesheet" href="([^"]+)"/i)?.[1];
  if (!stylesheetHref?.startsWith('/_astro/')) throw new Error(`${relativeName} is missing its Astro stylesheet`);
  const stylesheetPath = path.resolve(outputRoot, `.${decodeURIComponent(stylesheetHref)}`);
  if (!stylesheetPath.startsWith(`${outputRoot}${path.sep}`)) throw new Error(`${relativeName} has an invalid stylesheet path`);
  await access(stylesheetPath);

  const externalLinks = html.match(/<a\s[^>]*href="https:\/\/[^>]*>/gi) ?? [];
  for (const link of externalLinks) {
    if (!/target="_blank"/i.test(link)) throw new Error(`${relativeName} has an external link without target=_blank`);
    if (!/rel="[^"]*noopener[^"]*"/i.test(link)) throw new Error(`${relativeName} has an external link without noopener`);
    if (!/rel="[^"]*noreferrer[^"]*"/i.test(link)) throw new Error(`${relativeName} has an external link without noreferrer`);
  }
}

const canonicalUrls = new Map([
  ['index.html', 'https://mobile.ruban-labs.work/'],
  ['privacy/index.html', 'https://mobile.ruban-labs.work/privacy/'],
]);

for (const [relativeName, canonicalUrl] of canonicalUrls) {
  const html = await readFile(path.join(outputRoot, relativeName), 'utf8');
  if (!html.includes(`<link rel="canonical" href="${canonicalUrl}">`)) {
    throw new Error(`${relativeName} has an unexpected canonical URL`);
  }
}

const privacy = await readFile(path.join(outputRoot, 'privacy/index.html'), 'utf8');
for (const statement of ['does not require an account', 'does not collect', 'does not request access']) {
  if (!privacy.includes(statement)) throw new Error(`Privacy policy is missing: ${statement}`);
}

console.log('Ruban website checks passed');
