import * as React from 'react';
import {Linking} from 'react-native';
import {buildInfo} from './buildInfo';

const claimedRunIds: Record<string, boolean> = {};
const runIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;

function handleUrl(url: string | null | undefined): void {
  const prefix = 'gongshu-0.76://release-health?';
  if (!url || url.indexOf(prefix) !== 0) return;

  const params: Record<string, string> = {};
  url
    .slice(prefix.length)
    .split('&')
    .forEach(pair => {
      const separator = pair.indexOf('=');
      if (separator > 0) {
        params[decodeURIComponent(pair.slice(0, separator))] = decodeURIComponent(
          pair.slice(separator + 1),
        );
      }
    });

  const runId = params.runId;
  const expectedArchitecture = params.expectedArch;
  if (
    !runIdPattern.test(runId || '') ||
    claimedRunIds[runId] ||
    (expectedArchitecture !== 'old' && expectedArchitecture !== 'new')
  ) {
    return;
  }

  claimedRunIds[runId] = true;
  const actualArchitecture = buildInfo.architecture === 'newArch' ? 'new' : 'old';
  const passed =
    buildInfo.channel === 'release' &&
    buildInfo.engine === 'Hermes' &&
    actualArchitecture === expectedArchitecture;
  console.log(
    `[RUBAN-RELEASE] runId=${runId} result=${passed ? 'PASS' : 'FAIL'} engine=${
      buildInfo.engine
    } architecture=${actualArchitecture} channel=${buildInfo.channel}`,
  );
}

export function useReleaseRuntimeHealth(): void {
  React.useEffect(() => {
    let active = true;
    Linking.getInitialURL().then(url => {
      if (active) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));
    console.log('[RUBAN-RELEASE] health-listener=READY');
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}
