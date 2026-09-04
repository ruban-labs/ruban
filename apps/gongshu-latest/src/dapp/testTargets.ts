import {
  parseDappTestQuery,
  type DappTestCommand,
} from '@ruban-labs/react-native-dapp-bridge';

export type DappTestRouteQuery = {
  dapp?: string;
  method?: string;
  params?: string;
  runId?: string;
  timeoutMs?: string;
};

export type DappTestTarget = {
  id: string;
  title: string;
  url: string;
};

export type ResolvedDappTest = {
  target: DappTestTarget;
  command: DappTestCommand;
};

const targets: Record<string, DappTestTarget> = {
  metamask: {
    id: 'metamask',
    title: 'MetaMask Test DApp',
    url: 'https://metamask.github.io/test-dapp/',
  },
};

export function resolveDappTest(
  query: DappTestRouteQuery,
): ResolvedDappTest {
  const dapp = query.dapp || 'metamask';
  const target = targets[dapp];
  if (!target) throw new Error(`Unknown DApp test target: ${dapp}`);
  return {
    target,
    command: parseDappTestQuery(query),
  };
}

export const dappTestTargets = Object.freeze({...targets});
