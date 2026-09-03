export type EvmToken = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  priceId: string;
};

export type EvmChain = {
  id: number;
  key: string;
  name: string;
  nativeSymbol: string;
  nativeName: string;
  nativeDecimals: number;
  nativePriceId: string;
  rpcUrls: readonly string[];
  tokens: readonly EvmToken[];
};

export type PortfolioAsset = {
  chainId: number;
  chainName: string;
  symbol: string;
  name: string;
  contractAddress?: string;
  balance: string;
  displayBalance: string;
  priceUsd?: number;
  valueUsd?: number;
};

export type ChainPortfolio = {
  chain: EvmChain;
  assets: PortfolioAsset[];
  latencyMs: number;
  source: string;
  updatedAt: number;
  error?: string;
};

export type PortfolioSnapshot = {
  address: string;
  chains: ChainPortfolio[];
  assets: PortfolioAsset[];
  totalValueUsd: number;
  updatedAt: number;
};

export type RpcRequest = {
  method: string;
  params?: readonly unknown[];
};

export type RpcSourceContext =
  | { source: "app"; feature: string }
  | { source: "browser"; origin: string; sessionId: string };

export type EvmRpcRequest = RpcRequest & {
  context: RpcSourceContext;
  chainId: number;
};

export type PortfolioSyncOptions = {
  onChain?: (portfolio: ChainPortfolio) => void;
};

export type EvmClientOptions = {
  chains?: readonly EvmChain[];
  fetch?: EvmFetch;
  timeoutMs?: number;
  appConcurrency?: number;
  browserConcurrency?: number;
};

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type EvmFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: unknown;
  }
) => Promise<FetchResponse>;

type RpcResult = { result?: unknown; error?: { message?: string } };
type EndpointState = { latencyMs: number; failures: number };
type QueueTask = {
  run(): void;
};
type AbortControllerLike = { signal: unknown; abort(): void };
type RuntimeGlobals = {
  fetch?: EvmFetch;
  AbortController?: new () => AbortControllerLike;
  setTimeout(handler: () => void, milliseconds: number): unknown;
  clearTimeout(handle: unknown): void;
};

const runtimeGlobals = globalThis as unknown as RuntimeGlobals;

class RpcLane {
  private active: number;
  private readonly queue: QueueTask[];

  constructor(private readonly concurrency: number) {
    this.active = 0;
    this.queue = [];
  }

  schedule<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: () => {
          this.active += 1;
          Promise.resolve()
            .then(operation)
            .then(resolve, reject)
            .then(
              () => this.complete(),
              () => this.complete()
            );
        },
      });
      this.drain();
    });
  }

  private complete(): void {
    this.active -= 1;
    this.drain();
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const task = this.queue.shift();
      if (!task) return;
      task.run();
    }
  }
}

export const defaultEvmChains: readonly EvmChain[] = [
  {
    id: 1,
    key: "ethereum",
    name: "Ethereum",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    nativePriceId: "ethereum",
    rpcUrls: ["https://ethereum-rpc.publicnode.com", "https://1rpc.io/eth"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
        priceId: "usd-coin",
      },
    ],
  },
  {
    id: 8453,
    key: "base",
    name: "Base",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    nativePriceId: "ethereum",
    rpcUrls: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        decimals: 6,
        priceId: "usd-coin",
      },
    ],
  },
  {
    id: 42161,
    key: "arbitrum",
    name: "Arbitrum",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    nativePriceId: "ethereum",
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum-one-rpc.publicnode.com",
    ],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        decimals: 6,
        priceId: "usd-coin",
      },
    ],
  },
  {
    id: 10,
    key: "optimism",
    name: "Optimism",
    nativeSymbol: "ETH",
    nativeName: "Ether",
    nativeDecimals: 18,
    nativePriceId: "ethereum",
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://optimism-rpc.publicnode.com",
    ],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        decimals: 6,
        priceId: "usd-coin",
      },
    ],
  },
  {
    id: 137,
    key: "polygon",
    name: "Polygon",
    nativeSymbol: "POL",
    nativeName: "POL",
    nativeDecimals: 18,
    nativePriceId: "matic-network",
    rpcUrls: [
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon-rpc.com",
    ],
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
        decimals: 6,
        priceId: "usd-coin",
      },
    ],
  },
];

export class EvmClient {
  private readonly chains: readonly EvmChain[];
  private readonly fetcher: EvmFetch;
  private readonly endpointStates: Map<string, EndpointState>;
  private readonly inFlight: Map<string, Promise<unknown>>;
  private readonly timeoutMs: number;
  private readonly appLane: RpcLane;
  private readonly browserLane: RpcLane;
  private requestId: number;

  constructor(options: EvmClientOptions = {}) {
    this.chains = options.chains || defaultEvmChains;
    const globalFetch = runtimeGlobals.fetch;
    if (!options.fetch && !globalFetch)
      throw new Error("EvmClient requires fetch");
    this.fetcher = options.fetch || (globalFetch as EvmFetch);
    this.endpointStates = new Map<string, EndpointState>();
    this.inFlight = new Map<string, Promise<unknown>>();
    this.timeoutMs = options.timeoutMs || 8000;
    this.appLane = new RpcLane(normalizeConcurrency(options.appConcurrency, 6));
    this.browserLane = new RpcLane(
      normalizeConcurrency(options.browserConcurrency, 3)
    );
    this.requestId = 1;
  }

  getChain(chainId: number): EvmChain | undefined {
    return this.chains.find((chain) => chain.id === chainId);
  }

  request(request: EvmRpcRequest): Promise<unknown> {
    const chain = this.getChain(request.chainId);
    if (!chain)
      return Promise.reject(new Error(`Unsupported chain ${request.chainId}`));
    const namespace =
      request.context.source === "browser"
        ? `browser:${request.context.origin}:${request.context.sessionId}`
        : `app:${request.context.feature}`;
    const params = request.params || [];
    const key = `${namespace}:${request.chainId}:${
      request.method
    }:${JSON.stringify(params)}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const pending = this.schedule(request.context, () =>
      this.raceEndpoints(
        chain,
        [{ method: request.method, params }],
        request.context
      ).then((results) => results[0])
    );
    this.inFlight.set(key, pending);
    return pending.then(
      (value) => {
        this.inFlight.delete(key);
        return value;
      },
      (error) => {
        this.inFlight.delete(key);
        throw error;
      }
    );
  }

  async syncPortfolio(
    address: string,
    options: PortfolioSyncOptions = {}
  ): Promise<PortfolioSnapshot> {
    const pricePromise = this.loadPrices();
    const chainPromises = this.chains.map((chain) =>
      this.loadChainPortfolio(chain, address).then(
        (value) => {
          if (options.onChain) options.onChain(value);
          return value;
        },
        (error) => {
          const failed: ChainPortfolio = {
            chain,
            assets: [],
            latencyMs: 0,
            source: "unavailable",
            updatedAt: Date.now(),
            error: error instanceof Error ? error.message : "RPC unavailable",
          };
          if (options.onChain) options.onChain(failed);
          return failed;
        }
      )
    );
    const chains = await Promise.all(chainPromises);
    const prices = await pricePromise.catch(
      () => ({} as Record<string, number>)
    );
    const assets = chains
      .flatMap((chain) => chain.assets)
      .map((asset) => {
        const chain = this.getChain(asset.chainId);
        const token =
          chain && asset.contractAddress
            ? chain.tokens.find(
                (item) =>
                  item.address.toLowerCase() ===
                  asset.contractAddress!.toLowerCase()
              )
            : undefined;
        const priceId = token
          ? token.priceId
          : chain
          ? chain.nativePriceId
          : "";
        const priceUsd = prices[priceId];
        const numericBalance = Number(asset.displayBalance);
        const valueUsd =
          Number.isFinite(numericBalance) && priceUsd != null
            ? numericBalance * priceUsd
            : undefined;
        return { ...asset, priceUsd, valueUsd };
      });
    return {
      address,
      chains,
      assets,
      totalValueUsd: assets.reduce(
        (total, asset) => total + (asset.valueUsd || 0),
        0
      ),
      updatedAt: Date.now(),
    };
  }

  private async loadChainPortfolio(
    chain: EvmChain,
    address: string
  ): Promise<ChainPortfolio> {
    const startedAt = Date.now();
    const calls: RpcRequest[] = [
      { method: "eth_getBalance", params: [address, "latest"] },
      ...chain.tokens.map((token) => ({
        method: "eth_call",
        params: [
          { to: token.address, data: encodeBalanceOf(address) },
          "latest",
        ],
      })),
    ];
    const context: RpcSourceContext = { source: "app", feature: "portfolio" };
    const raced = await this.schedule(context, () =>
      this.raceEndpointsWithSource(chain, calls, context)
    );
    const assets: PortfolioAsset[] = [
      createAsset(
        chain,
        chain.nativeSymbol,
        chain.nativeName,
        undefined,
        chain.nativeDecimals,
        raced.results[0]
      ),
      ...chain.tokens.map((token, index) =>
        createAsset(
          chain,
          token.symbol,
          token.name,
          token.address,
          token.decimals,
          raced.results[index + 1]
        )
      ),
    ];
    return {
      chain,
      assets,
      latencyMs: Date.now() - startedAt,
      source: hostLabel(raced.url),
      updatedAt: Date.now(),
    };
  }

  private async raceEndpoints(
    chain: EvmChain,
    calls: readonly RpcRequest[],
    context: RpcSourceContext
  ): Promise<unknown[]> {
    const result = await this.raceEndpointsWithSource(chain, calls, context);
    return result.results;
  }

  private raceEndpointsWithSource(
    chain: EvmChain,
    calls: readonly RpcRequest[],
    context: RpcSourceContext
  ): Promise<{ url: string; results: unknown[] }> {
    const urls = [...chain.rpcUrls].sort(
      (left, right) =>
        this.endpointScore(left, context) - this.endpointScore(right, context)
    );
    return new Promise((resolve, reject) => {
      let failures = 0;
      let lastError: unknown = new Error("No RPC endpoints configured");
      for (const url of urls.slice(0, 2)) {
        this.postRpc(url, calls, context).then(
          (results) => resolve({ url, results }),
          (error) => {
            failures += 1;
            lastError = error;
            if (failures === Math.min(urls.length, 2)) reject(lastError);
          }
        );
      }
      if (urls.length === 0) reject(lastError);
    });
  }

  private async postRpc(
    url: string,
    calls: readonly RpcRequest[],
    context: RpcSourceContext
  ): Promise<unknown[]> {
    const startedAt = Date.now();
    const payload = calls.map((call) => ({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: call.method,
      params: call.params || [],
    }));
    const AbortControllerConstructor = runtimeGlobals.AbortController;
    const controller = AbortControllerConstructor
      ? new AbortControllerConstructor()
      : null;
    const timer = runtimeGlobals.setTimeout(() => {
      if (controller) controller.abort();
    }, this.timeoutMs);
    try {
      if (
        context.source === "browser" &&
        (!context.origin || !context.sessionId)
      ) {
        throw new Error("Browser RPC requires origin and sessionId");
      }
      const response = await this.fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload.length === 1 ? payload[0] : payload),
        signal: controller ? controller.signal : undefined,
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const body = await response.json();
      const rows = Array.isArray(body)
        ? (body as RpcResult[])
        : [body as RpcResult];
      const byId = new Map<number, RpcResult>();
      for (const row of rows) {
        const id = (row as RpcResult & { id?: number }).id;
        if (typeof id === "number") byId.set(id, row);
      }
      const results = payload.map((item) => {
        const row = byId.get(item.id);
        if (!row) throw new Error("RPC response was incomplete");
        if (row.error)
          throw new Error(row.error.message || "RPC request failed");
        return row.result;
      });
      this.endpointStates.set(this.endpointStateKey(context, url), {
        latencyMs: Date.now() - startedAt,
        failures: 0,
      });
      return results;
    } catch (error) {
      const stateKey = this.endpointStateKey(context, url);
      const current = this.endpointStates.get(stateKey);
      this.endpointStates.set(stateKey, {
        latencyMs: current ? current.latencyMs : this.timeoutMs,
        failures: (current ? current.failures : 0) + 1,
      });
      throw error;
    } finally {
      runtimeGlobals.clearTimeout(timer);
    }
  }

  private endpointScore(url: string, context?: RpcSourceContext): number {
    const state = this.endpointStates.get(
      `${context ? context.source : "app"}:${url}`
    );
    return state
      ? state.latencyMs + state.failures * this.timeoutMs
      : this.timeoutMs / 2;
  }

  private endpointStateKey(context: RpcSourceContext, url: string): string {
    return `${context.source}:${url}`;
  }

  private schedule<T>(
    context: RpcSourceContext,
    operation: () => Promise<T>
  ): Promise<T> {
    return (
      context.source === "browser" ? this.browserLane : this.appLane
    ).schedule(operation);
  }

  private async loadPrices(): Promise<Record<string, number>> {
    const ids = Array.from(
      new Set(
        this.chains.flatMap((chain) => [
          chain.nativePriceId,
          ...chain.tokens.map((token) => token.priceId),
        ])
      )
    );
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids.join(",")
    )}&vs_currencies=usd`;
    const response = await this.fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      body: "",
    });
    if (!response.ok) throw new Error(`Price HTTP ${response.status}`);
    const body = (await response.json()) as Record<string, { usd?: number }>;
    const prices: Record<string, number> = {};
    for (const id of ids)
      if (body[id] && typeof body[id].usd === "number")
        prices[id] = body[id].usd as number;
    return prices;
  }
}

export function createEvmClient(
  options: ConstructorParameters<typeof EvmClient>[0] = {}
): EvmClient {
  return new EvmClient(options);
}

function normalizeConcurrency(
  value: number | undefined,
  fallback: number
): number {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

export function hexQuantityToDecimal(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return "0";
  let decimal = "0";
  for (const digit of value.slice(2).toLowerCase())
    decimal = addDecimal(multiplyDecimal(decimal, 16), parseInt(digit, 16));
  return decimal;
}

export function formatUnits(
  value: string,
  decimals: number,
  precision = 5
): string {
  const padded = value.padStart(decimals + 1, "0");
  const integer = padded.slice(0, padded.length - decimals);
  const fraction = padded
    .slice(padded.length - decimals, padded.length - decimals + precision)
    .replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

function multiplyDecimal(value: string, multiplier: number): string {
  let carry = 0;
  let output = "";
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const next = Number(value[index]) * multiplier + carry;
    output = String(next % 10) + output;
    carry = Math.floor(next / 10);
  }
  while (carry > 0) {
    output = String(carry % 10) + output;
    carry = Math.floor(carry / 10);
  }
  return output.replace(/^0+(?=\d)/, "");
}

function addDecimal(value: string, amount: number): string {
  const digits = value.split("");
  let carry = amount;
  for (let index = digits.length - 1; index >= 0 && carry > 0; index -= 1) {
    const next = Number(digits[index]) + carry;
    digits[index] = String(next % 10);
    carry = Math.floor(next / 10);
  }
  while (carry > 0) {
    digits.unshift(String(carry % 10));
    carry = Math.floor(carry / 10);
  }
  return digits.join("");
}

function encodeBalanceOf(address: string): string {
  return `0x70a08231${address
    .toLowerCase()
    .replace(/^0x/, "")
    .padStart(64, "0")}`;
}

function createAsset(
  chain: EvmChain,
  symbol: string,
  name: string,
  contractAddress: string | undefined,
  decimals: number,
  raw: unknown
): PortfolioAsset {
  const balance = hexQuantityToDecimal(raw);
  return {
    chainId: chain.id,
    chainName: chain.name,
    symbol,
    name,
    contractAddress,
    balance,
    displayBalance: formatUnits(balance, decimals),
  };
}

function hostLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").split("/")[0] || url;
}
