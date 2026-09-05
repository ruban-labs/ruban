import * as React from 'react';
import {Linking} from 'react-native';
import {buildInfo} from '../buildInfo';
import {appEnvironment} from '../runtime/appEnvironment';

const handledRunIds = new Set<string>();

type RuntimeReadyRequest = {runId: string; receiptUrl?: string};

function parseRuntimeReady(
  url: string | null | undefined,
): RuntimeReadyRequest | null {
  if (!url || url.length > 512 || appEnvironment === 'production') {
    return null;
  }
  const scheme =
    appEnvironment === 'debug' ? 'ruban-rn066-debug' : 'ruban-rn066-regression';
  const prefix = `${scheme}://dev/runtime-ready?`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  try {
    const values: {[key: string]: string} = {};
    for (const pair of url.slice(prefix.length).split('&')) {
      const separator = pair.indexOf('=');
      if (separator < 1) {
        return null;
      }
      const key = decodeURIComponent(pair.slice(0, separator));
      if (!['runId', 'receiptUrl'].includes(key) || values[key]) {
        return null;
      }
      values[key] = decodeURIComponent(pair.slice(separator + 1));
    }
    const runId = values.runId;
    if (!runId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(runId)) {
      return null;
    }
    const receiptUrl = values.receiptUrl;
    if (receiptUrl) {
      const match = /^http:\/\/localhost:([1-9][0-9]{0,4})\/receipt$/.exec(
        receiptUrl,
      );
      if (!match || Number(match[1]) > 65535) {
        return null;
      }
    }
    return {runId, ...(receiptUrl ? {receiptUrl} : {})};
  } catch {
    return null;
  }
}

async function handleUrl(url: string | null | undefined): Promise<void> {
  const request = parseRuntimeReady(url);
  if (!request) {
    return;
  }
  const {runId, receiptUrl} = request;
  if (handledRunIds.size >= 128) {
    handledRunIds.clear();
  }
  handledRunIds.add(runId);
  const receipt = {
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
  };
  console.info(`RUBAN_APP_INTENT_RECEIPT ${JSON.stringify(receipt)}`);
  if (receiptUrl) {
    try {
      await fetch(receiptUrl, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(receipt),
      });
    } catch {
      console.info(`RUBAN_APP_INTENT_CALLBACK_FAILED ${runId}`);
    }
  }
}

export function AppIntentRuntime(): null {
  React.useEffect(() => {
    let active = true;
    Linking.getInitialURL().then(url => {
      if (active) {
        handleUrl(url);
      }
    });
    const subscription = Linking.addEventListener('url', event => {
      if (active) {
        handleUrl(event.url);
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return null;
}
