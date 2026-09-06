import type { RubanAppEnvironment } from '../runtime/appEnvironment';

export type AppIntentSource = 'ui' | 'deep-link' | 'background' | 'worker';

export type AppIntent =
  | { action: 'runtime.ready' }
  | {
      action: 'wallet.add-watch-address';
      address: string;
      label: string;
    }
  | {
      action: 'wallet.select-account';
      accountId?: string;
      address?: string;
    }
  | {
      action: 'wallet.delete-account';
      accountId?: string;
      address?: string;
    }
  | { action: 'wallet.create-mnemonic' }
  | { action: 'wallet.import-mnemonic' }
  | { action: 'wallet.import-private-key' }
  | { action: 'wallet.select-chain'; chainId: number }
  | {
      action: 'portfolio.sync';
      address: string;
      providerMode: 'current' | 'mock';
    }
  | {
      action: 'dapp.resolve-review';
      decision: 'approve' | 'reject';
      expectedMethod?: string;
      timeoutMs: number;
    };

export type AppIntentEnvelope = {
  runId: string;
  source: AppIntentSource;
  intent: AppIntent;
  receiptUrl?: string;
};

export type AppIntentResult = Record<
  string,
  string | number | boolean | null
>;

export type AppIntentReceipt = {
  runId: string;
  action: AppIntent['action'];
  source: AppIntentSource;
  status: 'succeeded' | 'failed';
  result?: AppIntentResult;
  errorCode?: string;
  completedAt: number;
};

export class AppIntentFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AppIntentFailure';
    this.code = code;
  }
}

let generatedRunIdCounter = 0;

export function createAppIntentEnvelope(
  intent: AppIntent,
  source: AppIntentSource = 'ui',
): AppIntentEnvelope {
  generatedRunIdCounter = (generatedRunIdCounter + 1) % 1_000_000;
  return {
    runId: `${source}-${Date.now().toString(36)}-${generatedRunIdCounter.toString(
      36,
    )}`,
    source,
    intent,
  };
}

function parseQuery(
  query: string,
  allowedKeys: ReadonlySet<string>,
): Record<string, string> | null {
  if (!query) return null;
  const values: Record<string, string> = {};
  try {
    for (const pair of query.split('&')) {
      const separator = pair.indexOf('=');
      if (separator < 1) return null;
      const key = decodeURIComponent(pair.slice(0, separator));
      if (!allowedKeys.has(key) || Object.hasOwn(values, key)) return null;
      values[key] = decodeURIComponent(
        pair.slice(separator + 1).replace(/\+/g, '%20'),
      );
    }
    return values;
  } catch {
    return null;
  }
}

function isRunId(value: string | undefined): value is string {
  return !!value && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
}

function normalizeAddress(value: string | undefined): string | null {
  const normalized = value?.toLowerCase();
  return normalized && /^0x[0-9a-f]{40}$/.test(normalized)
    ? normalized
    : null;
}

function normalizeLabel(value: string | undefined): string | null {
  const label = value?.trim() || 'Watch account';
  if (!label || label.length > 64) return null;
  const hasControlCharacter = Array.from(label).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  return hasControlCharacter ? null : label;
}

function parseCanonicalPositiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseBoundedTimeout(value: string | undefined): number | null {
  if (value == null) return 30_000;
  const parsed = parseCanonicalPositiveInteger(value);
  return parsed != null && parsed <= 60_000 ? parsed : null;
}

function normalizeReceiptUrl(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^http:\/\/localhost:([1-9][0-9]{0,4})\/receipt$/.exec(value);
  if (!match) return null;
  const port = Number(match[1]);
  return port <= 65535 ? value : null;
}

export function parseDeveloperAppIntent(
  url: string | null | undefined,
  environment: RubanAppEnvironment,
): AppIntentEnvelope | null {
  if (!url || url.length > 1024 || environment === 'production') return null;
  const scheme = environment === 'debug' ? 'ruban-debug' : 'ruban-regression';
  const prefix = `${scheme}://dev/`;
  if (!url.startsWith(prefix)) return null;

  const remainder = url.slice(prefix.length);
  const queryStart = remainder.indexOf('?');
  if (queryStart <= 0 || remainder.indexOf('#') >= 0) return null;
  const actionPath = remainder.slice(0, queryStart);
  const queryText = remainder.slice(queryStart + 1);

  const allowedKeysByPath: Record<string, ReadonlySet<string>> = {
    'runtime-ready': new Set(['runId', 'receiptUrl']),
    'address/add': new Set(['runId', 'receiptUrl', 'address', 'label']),
    'address/select': new Set(['runId', 'receiptUrl', 'address']),
    'address/delete': new Set(['runId', 'receiptUrl', 'address']),
    'chain/select': new Set(['runId', 'receiptUrl', 'chainId']),
    'portfolio/sync': new Set(['runId', 'receiptUrl', 'address', 'provider']),
    'dapp/review': new Set([
      'runId',
      'receiptUrl',
      'decision',
      'method',
      'timeoutMs',
    ]),
  };
  const allowedKeys = allowedKeysByPath[actionPath];
  if (!allowedKeys) return null;
  const query = parseQuery(queryText, allowedKeys);
  if (!query || !isRunId(query.runId)) return null;

  let intent: AppIntent | null = null;
  if (actionPath === 'runtime-ready') {
    intent = { action: 'runtime.ready' };
  } else if (actionPath === 'address/add') {
    const address = normalizeAddress(query.address);
    const label = normalizeLabel(query.label);
    if (address && label) {
      intent = { action: 'wallet.add-watch-address', address, label };
    }
  } else if (actionPath === 'address/select') {
    const address = normalizeAddress(query.address);
    if (address) intent = { action: 'wallet.select-account', address };
  } else if (actionPath === 'address/delete') {
    const address = normalizeAddress(query.address);
    if (address) intent = { action: 'wallet.delete-account', address };
  } else if (actionPath === 'chain/select') {
    const chainId = parseCanonicalPositiveInteger(query.chainId);
    if (chainId) intent = { action: 'wallet.select-chain', chainId };
  } else if (actionPath === 'portfolio/sync') {
    const address = normalizeAddress(query.address);
    const providerMode = query.provider;
    if (address && (providerMode === 'current' || providerMode === 'mock')) {
      intent = { action: 'portfolio.sync', address, providerMode };
    }
  } else if (actionPath === 'dapp/review') {
    const decision = query.decision;
    const timeoutMs = parseBoundedTimeout(query.timeoutMs);
    const expectedMethod = query.method;
    if (
      (decision === 'approve' || decision === 'reject') &&
      timeoutMs != null &&
      (!expectedMethod || /^[a-zA-Z0-9_]{1,64}$/.test(expectedMethod))
    ) {
      intent = {
        action: 'dapp.resolve-review',
        decision,
        timeoutMs,
        ...(expectedMethod ? { expectedMethod } : {}),
      };
    }
  }

  const receiptUrl = normalizeReceiptUrl(query.receiptUrl);
  if (query.receiptUrl && !receiptUrl) return null;

  return intent
    ? {
        runId: query.runId,
        source: 'deep-link',
        intent,
        ...(receiptUrl ? { receiptUrl } : {}),
      }
    : null;
}
