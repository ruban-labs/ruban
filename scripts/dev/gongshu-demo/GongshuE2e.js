// Gongshu E2E - deep-link driven smoke scenario runner.
// Adapted (minimal) from rabby-mobile's regression framework: an explicit,
// valid, one-shot command arms a scenario that invokes the SAME handlers the
// UI buttons use, then reports structured `[GONGSHU-E2E]` console lines that
// the host runner greps from logcat.
//
// Trigger (shell launch, NOT subject to EMUI cross-app launch interception,
// unlike maestro's on-device driver):
//   adb shell am start -a android.intent.action.VIEW \
//     -d "gongshu-<era>://e2e?scenario=demo-smoke&runId=<id>"
//
// Gates: scheme must match this era, scenario must be demo-smoke, runId must
// be opaque and unclaimed (one-shot per app process). No credentials may ever
// ride in the URL.
// Kept ES2019-safe: this file is copied verbatim into the 0.66 era app.

import * as React from 'react';
import { Linking } from 'react-native';

const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;
const STEP_TIMEOUT_MS = 5000;
const NEAR = 0.001;
const claimedRunIds = {};

function near(value, expected) {
  return Math.abs(value - expected) < NEAR;
}

const STEPS = [
  { name: 'bar-inc', act: (api) => api.barInc(), expect: (s) => near(s.bar, 0.3) },
  { name: 'bar-dec', act: (api) => api.barDec(), expect: (s) => near(s.bar, 0.2) },
  { name: 'circle-inc', act: (api) => api.circleInc(), expect: (s) => near(s.circle, 0.5) },
  { name: 'circle-inc-2', act: (api) => api.circleInc(), expect: (s) => near(s.circle, 0.6) },
  { name: 'pie-dec', act: (api) => api.pieDec(), expect: (s) => near(s.pie, 0.5) },
  { name: 'snail-stop', act: (api) => api.snailToggle(), expect: (s) => s.snail === false },
  { name: 'snail-start', act: (api) => api.snailToggle(), expect: (s) => s.snail === true },
];

function log(line) {
  console.log('[GONGSHU-E2E] ' + line);
}

export function schemeForEra(era) {
  if (era === '0.76') return 'gongshu-0.76';
  if (era === '0.66') return 'gongshu-0.66';
  return 'gongshu-latest';
}

function parseCommand(url, era) {
  if (typeof url !== 'string') return null;
  const prefix = schemeForEra(era) + '://e2e?';
  if (url.indexOf(prefix) !== 0) return null;
  const params = {};
  url
    .slice(prefix.length)
    .split('&')
    .forEach((pair) => {
      const at = pair.indexOf('=');
      if (at > 0) {
        params[decodeURIComponent(pair.slice(0, at))] = decodeURIComponent(pair.slice(at + 1));
      }
    });
  if (params.scenario !== 'demo-smoke') return null;
  if (!RUN_ID_PATTERN.test(params.runId || '')) return null;
  return { runId: params.runId };
}

export default function useGongshuE2e(era, api) {
  const [label, setLabel] = React.useState('');
  const [, setTick] = React.useState(0);
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const engineRef = React.useRef(null);

  function runStep() {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.index >= STEPS.length) {
      finish();
      return;
    }
    const step = STEPS[engine.index];
    engine.startedAt = Date.now();
    log('runId=' + engine.runId + ' step=' + step.name + ' do');
    step.act(apiRef.current);
    setTimeout(() => setTick((t) => t + 1), STEP_TIMEOUT_MS + 500);
  }

  function finish() {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.failed.length === 0) {
      log('runId=' + engine.runId + ' result=PASS steps=' + STEPS.length);
      setLabel('e2e PASS');
    } else {
      log('runId=' + engine.runId + ' result=FAIL failed=' + engine.failed.join('|'));
      setLabel('e2e FAIL');
    }
    engineRef.current = null;
  }

  React.useEffect(() => {
    const engine = engineRef.current;
    if (!engine || engine.index >= STEPS.length) return;
    const step = STEPS[engine.index];
    if (step.expect(apiRef.current.getState())) {
      log('runId=' + engine.runId + ' step=' + step.name + ' pass');
      engine.index += 1;
      setTimeout(runStep, 250);
      return;
    }
    if (engine.startedAt > 0 && Date.now() - engine.startedAt > STEP_TIMEOUT_MS) {
      log('runId=' + engine.runId + ' step=' + step.name + ' fail');
      engine.failed.push(step.name);
      engine.index += 1;
      setTimeout(runStep, 250);
    }
  });

  const arm = React.useCallback(
    (url) => {
      const command = parseCommand(url, era);
      if (!command || claimedRunIds[command.runId] || engineRef.current) return;
      claimedRunIds[command.runId] = true;
      engineRef.current = { runId: command.runId, index: 0, failed: [], startedAt: 0 };
      log('runId=' + command.runId + ' armed scenario=demo-smoke era=' + era);
      setTimeout(runStep, 400);
    },
    [era]
  );

  React.useEffect(() => {
    let active = true;
    Linking.getInitialURL()
      .then((url) => {
        if (active) arm(url);
      })
      .catch(() => {});
    const subscription = Linking.addEventListener('url', (event) => arm(event.url));
    const remove = () => {
      active = false;
      if (subscription && subscription.remove) subscription.remove();
    };
    return remove;
  }, [arm]);

  return label;
}
