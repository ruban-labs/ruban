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
    scheme: 'ruban-rn066-debug',
    homeTitle: 'Components',
    settingsBuildEntry: 'Build & matrix',
    settingsBuildTitle: 'Build & Matrix',
    android: 'com.rubanlabs.mobile.gongshu.rn066.debug',
    ios: 'com.rubanlabs.mobile.gongshu.rn066.debug',
  },
  {
    era: '0.77',
    scheme: 'ruban-rn077-debug',
    homeTitle: 'Components',
    settingsBuildEntry: 'Build & matrix',
    settingsBuildTitle: 'Build & Matrix',
    android: 'com.rubanlabs.mobile.gongshu.rn077.debug',
    ios: 'com.rubanlabs.mobile.gongshu.rn077.debug',
  },
  {
    era: 'latest',
    scheme: 'ruban-debug',
    homeTitle: 'Portfolio',
    settingsBuildEntry: 'Build & matrix',
    settingsBuildTitle: 'Build & matrix',
    android: 'com.rubanlabs.mobile.debug',
    ios: 'com.rubanlabs.mobile.debug',
  },
];

const TEMPLATES = ['android', 'ios'];
const flowsDir = path.join(harnessRoot, 'flows');
fs.mkdirSync(flowsDir, { recursive: true });

function openPrompt(platform) {
  return platform === 'ios'
    ? `- tapOn:
    text: "^(Open|打开)$"
    optional: true\n`
    : '';
}

function beforeExternalLink(app, platform) {
  // The iOS 18 simulator confirms custom-scheme URLs most reliably when the
  // target starts cold. Exercise each latest iOS link through its launch-URL
  // path so this smoke test does not depend on a foreground confirmation.
  return app.era === 'latest' && platform === 'ios' ? '- stopApp\n' : '';
}

function initialAssertions(app, platform) {
  if (app.era === 'latest') {
    return `- extendedWaitUntil:
    visible:
      text: "Portfolio"
    timeout: 120000
- assertVisible:
    text: "Create a wallet"
- assertVisible:
    text: "Network, Ethereum"`;
  }

  return `- extendedWaitUntil:
    visible:
      text: "${app.homeTitle}"
    timeout: ${platform === 'ios' ? '120000' : '60000'}
- assertVisible:
    text: "{{buttonSelector}}"
- assertVisible:
    text: "Playground"`;
}

function openButtonShowcase(app, platform) {
  if (app.era === 'latest') {
    return `${beforeExternalLink(app, platform)}- openLink: "${app.scheme}://components/button?theme=light&variant=primary&size=md&state=default"
${openPrompt(platform)}`.trimEnd();
  }

  return `- tapOn:
    text: "{{buttonSelector}}"`;
}

function afterButtonShowcase(app) {
  if (app.era === 'latest') return '';

  return `- tapOn:
    text: "Back to components"
- extendedWaitUntil:
    visible:
      text: "${app.homeTitle}"
    timeout: 20000`;
}

function openPlayground(app, platform) {
  if (app.era === 'latest') {
    return `${beforeExternalLink(app, platform)}- openLink: "${app.scheme}://lab/design?theme=light"
${openPrompt(platform)}`.trimEnd();
  }

  return `- openLink: "${app.scheme}://home"
${openPrompt(platform)}- extendedWaitUntil:
    visible:
      text: "${app.homeTitle}"
    timeout: 20000
- tapOn:
    text: "Playground"`;
}

function openSettings(app, platform) {
  if (app.era === 'latest') {
    return `${beforeExternalLink(app, platform)}- openLink: "${app.scheme}://settings"
${openPrompt(platform)}`.trimEnd();
  }

  return `- tapOn:
    text: "Settings"`;
}

for (const platform of TEMPLATES) {
  const template = fs.readFileSync(path.join(harnessRoot, 'templates', `demo-smoke.${platform}.yaml.tpl`), 'utf8');
  for (const app of APPS) {
    const rendered = template
      .replaceAll('{{appId}}', app[platform])
      .replaceAll('{{era}}', app.era)
      .replaceAll('{{homeTitle}}', app.homeTitle)
      .replaceAll('{{settingsBuildEntry}}', app.settingsBuildEntry)
      .replaceAll('{{settingsBuildTitle}}', app.settingsBuildTitle)
      .replaceAll('{{scheme}}', app.scheme)
      .replaceAll('{{initialAssertions}}', initialAssertions(app, platform))
      .replaceAll('{{openButtonShowcase}}', openButtonShowcase(app, platform))
      .replaceAll('{{afterButtonShowcase}}', afterButtonShowcase(app))
      .replaceAll('{{openPlayground}}', openPlayground(app, platform))
      .replaceAll('{{openSettings}}', openSettings(app, platform))
      .replaceAll('{{beforeExternalLink}}', beforeExternalLink(app, platform))
      .replaceAll('{{buttonShowcaseReady}}', 'Button')
      .replaceAll('{{badgeShowcaseReady}}', 'LIVE')
      .replaceAll('{{buttonSelector}}', platform === 'ios' ? '01.*Button.*' : 'Button');
    const outFile = path.join(flowsDir, `${platform}-${app.era}-demo-smoke.yaml`);
    fs.writeFileSync(outFile, rendered);
    console.log(`gen-flows: wrote ${path.relative(harnessRoot, outFile)}`);
  }
}
