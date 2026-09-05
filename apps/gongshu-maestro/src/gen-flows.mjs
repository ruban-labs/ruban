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

function openDeepLink(app, platform, path, expectedText) {
  const url = `${app.scheme}://${path}`;
  if (platform !== 'ios') {
    return `- openLink: "${url}"`;
  }

  const stopApp = app.era === 'latest' ? '      - stopApp\n' : '';
  const timeout = app.era === 'latest' ? 120000 : 20000;
  return `- retry:
    maxRetries: 1
    commands:
${stopApp}      - openLink: "${url}"
      - tapOn:
          text: "^(Open|打开)$"
          optional: true
      - extendedWaitUntil:
          visible:
            text: "${expectedText}"
          timeout: ${timeout}`;
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
    return openDeepLink(
      app,
      platform,
      'components/button?theme=light&variant=primary&size=md&state=default',
      'RUN ACTION'
    );
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
    return openDeepLink(app, platform, 'lab/design?theme=light', 'PLAYGROUND');
  }

  return `${openDeepLink(app, platform, 'home', app.homeTitle)}
- extendedWaitUntil:
    visible:
      text: "${app.homeTitle}"
    timeout: 20000
- tapOn:
    text: "Playground"`;
}

function openSettings(app, platform) {
  if (app.era === 'latest') {
    return openDeepLink(app, platform, 'settings', 'Appearance.*');
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
      .replaceAll(
        '{{openBadgeShowcase}}',
        openDeepLink(app, platform, 'components/badge?theme=light&variant=live&size=md', 'Badge')
      )
      .replaceAll(
        '{{openSeparatorShowcase}}',
        openDeepLink(
          app,
          platform,
          'components/separator?theme=dark&orientation=vertical&tone=accent&weight=bold',
          'Live separator vertical accent bold'
        )
      )
      .replaceAll(
        '{{openSwitchShowcase}}',
        openDeepLink(app, platform, 'components/switch?theme=light&state=on&size=md', 'Live switch state ON')
      )
      .replaceAll(
        '{{openSequentialDialogShowcase}}',
        openDeepLink(app, platform, 'components/dialog?theme=light&scenario=sequential', 'FIRST DIALOG')
      )
      .replaceAll(
        '{{openNestedDialogShowcase}}',
        openDeepLink(app, platform, 'components/dialog?theme=dark&scenario=nested', 'PARENT DIALOG')
      )
      .replaceAll(
        '{{openExternalDialogShowcase}}',
        openDeepLink(app, platform, 'components/dialog?theme=light&scenario=external', 'RELEASE GATE')
      )
      .replaceAll('{{openPlayground}}', openPlayground(app, platform))
      .replaceAll('{{openSettings}}', openSettings(app, platform))
      .replaceAll('{{buttonSelector}}', platform === 'ios' ? '01.*Button.*' : 'Button');
    const outFile = path.join(flowsDir, `${platform}-${app.era}-demo-smoke.yaml`);
    fs.writeFileSync(outFile, rendered);
    console.log(`gen-flows: wrote ${path.relative(harnessRoot, outFile)}`);
  }
}
