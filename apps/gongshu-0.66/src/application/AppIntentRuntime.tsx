import * as React from 'react';
import {Linking} from 'react-native';
import {buildInfo} from '../buildInfo';
import {appEnvironment} from '../runtime/appEnvironment';

const handledRunIds = new Set<string>();

function parseRuntimeReady(url: string | null | undefined): string | null {
  if (!url || url.length > 256 || appEnvironment === 'production') return null;
  const scheme =
    appEnvironment === 'debug'
      ? 'ruban-rn066-debug'
      : 'ruban-rn066-regression';
  const prefix = `${scheme}://dev/runtime-ready?runId=`;
  if (!url.startsWith(prefix)) return null;
  try {
    const runId = decodeURIComponent(url.slice(prefix.length));
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(runId) ? runId : null;
  } catch {
    return null;
  }
}

function handleUrl(url: string | null | undefined): void {
  const runId = parseRuntimeReady(url);
  if (!runId) return;
  if (handledRunIds.size >= 128) handledRunIds.clear();
  handledRunIds.add(runId);
  console.info(
    `RUBAN_APP_INTENT_RECEIPT ${JSON.stringify({
      runId,
      action: 'runtime.ready',
      source: 'deep-link',
      status: 'succeeded',
      result: {
        edition: buildInfo.edition,
        reactNative: buildInfo.reactNative,
        architecture: buildInfo.architecture,
        engine: buildInfo.engine,
        platform: buildInfo.platform,
        environment: buildInfo.environment,
      },
      completedAt: Date.now(),
    })}`,
  );
}

export function AppIntentRuntime(): null {
  React.useEffect(() => {
    let active = true;
    Linking.getInitialURL().then(url => {
      if (active) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', event => {
      if (active) handleUrl(event.url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return null;
}
