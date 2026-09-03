import {
  EvmClient,
  formatUnits,
  hexQuantityToDecimal,
  type EvmChain,
} from "../index";

const chain: EvmChain = {
  id: 1,
  key: "test",
  name: "Test",
  nativeSymbol: "ETH",
  nativeName: "Ether",
  nativeDecimals: 18,
  nativePriceId: "ethereum",
  rpcUrls: ["https://slow.example", "https://fast.example"],
  tokens: [],
};

test("formats uint256 values without relying on BigInt", () => {
  expect(hexQuantityToDecimal("0xde0b6b3a7640000")).toBe("1000000000000000000");
  expect(formatUnits("1000000000000000000", 18)).toBe("1");
});

test("coalesces duplicate requests and takes the first healthy endpoint", async () => {
  let calls = 0;
  const fetcher = jest.fn(async (url: string) => {
    calls += 1;
    if (url.includes("slow")) return new Promise<never>(() => {});
    return {
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: url.includes("fast") ? 2 : 1,
        result: "0x1",
      }),
    };
  });
  const client = new EvmClient({
    chains: [chain],
    fetch: fetcher,
    timeoutMs: 100,
  });
  const request = {
    context: { source: "app" as const, feature: "test" },
    chainId: 1,
    method: "eth_chainId",
  };
  const first = client.request(request);
  const second = client.request(request);
  await expect(first).resolves.toBe("0x1");
  await expect(second).resolves.toBe("0x1");
  expect(calls).toBe(2);
});

test("keeps app and browser scheduling lanes independent without leaking context", async () => {
  const singleEndpointChain = { ...chain, rpcUrls: ["https://rpc.example"] };
  const releases: Array<() => void> = [];
  const bodies: string[] = [];
  const fetcher = jest.fn(async (_url: string, init: { body: string }) => {
    bodies.push(init.body);
    await new Promise<void>((resolve) => releases.push(resolve));
    const body = JSON.parse(init.body) as { id: number };
    return {
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: "2.0", id: body.id, result: "0x1" }),
    };
  });
  const client = new EvmClient({
    chains: [singleEndpointChain],
    fetch: fetcher,
    appConcurrency: 1,
    browserConcurrency: 1,
  });
  const appFirst = client.request({
    context: { source: "app", feature: "portfolio" },
    chainId: 1,
    method: "eth_blockNumber",
  });
  const appQueued = client.request({
    context: { source: "app", feature: "activity" },
    chainId: 1,
    method: "eth_chainId",
  });
  const browserFirst = client.request({
    context: {
      source: "browser",
      origin: "https://app.example",
      sessionId: "session-1",
    },
    chainId: 1,
    method: "eth_chainId",
  });

  await Promise.resolve();
  await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(bodies.join(" ")).not.toContain("source");
  expect(bodies.join(" ")).not.toContain("app.example");

  releases.splice(0).forEach((release) => release());
  await Promise.all([appFirst, browserFirst]);
  await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(3);
  releases.splice(0).forEach((release) => release());
  await expect(appQueued).resolves.toBe("0x1");
});
