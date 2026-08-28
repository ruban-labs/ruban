#!/usr/bin/env node
// Generate per-era Maestro flows from templates. The generated files under
// flows/ are committed so CI can run `maestro check-syntax` without the
// generator; re-run this script whenever the templates or the era table
// changes.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const harnessRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Keep in sync with apps/gongshu-* package/bundle identifiers.
const APPS = [
  {
    era: '0.66',
    android: 'com.rubanlabs.mobile.gongshu.rn066.debug',
    ios: 'com.rubanlabs.mobile.gongshu.rn066.debug',
  },
  {
    era: '0.76',
    android: 'com.rubanlabs.mobile.gongshu.rn076.debug',
    ios: 'com.rubanlabs.mobile.gongshu.rn076.debug',
  },
  {
    era: 'latest',
    android: 'com.rubanlabs.mobile.debug',
    ios: 'com.rubanlabs.mobile.debug',
  },
];

const TEMPLATES = ['android', 'ios'];
const flowsDir = path.join(harnessRoot, 'flows');
fs.mkdirSync(flowsDir, { recursive: true });

for (const platform of TEMPLATES) {
  const template = fs.readFileSync(path.join(harnessRoot, 'templates', `demo-smoke.${platform}.yaml.tpl`), 'utf8');
  for (const app of APPS) {
    const rendered = template.replaceAll('{{appId}}', app[platform]).replaceAll('{{era}}', app.era);
    const outFile = path.join(flowsDir, `${platform}-${app.era}-demo-smoke.yaml`);
    fs.writeFileSync(outFile, rendered);
    console.log(`gen-flows: wrote ${path.relative(harnessRoot, outFile)}`);
  }
}
