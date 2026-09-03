import {
  createBridgeEventScript,
  createBridgeResponseScript,
  createDappTestCommandScript,
  createProviderContentScript,
  DappBridgeHostSession,
  DappBridgeProtocolError,
  parseDappBridgeMessage,
  parseDappTestQuery,
  parseDappTestResultMessage,
} from "../index";

const providerInfo = {
  name: "Ruban Dev",
  icon: "data:image/svg+xml;base64,PHN2Zy8+",
  rdns: "work.ruban-labs.mobile.debug",
} as const;

test("parses only the current typed session", () => {
  const request = parseDappBridgeMessage(
    JSON.stringify({
      channel: "ruban-eip1193-v1",
      sessionId: "session-1",
      documentId: "document-1",
      id: 1,
      method: "eth_chainId",
      params: [],
    }),
    "session-1"
  );
  expect(request.method).toBe("eth_chainId");
  expect(() =>
    parseDappBridgeMessage(
      JSON.stringify({ ...request, sessionId: "old" }),
      "session-1"
    )
  ).toThrow(DappBridgeProtocolError);
});

test("generates executable scripts without embedding an origin claim", () => {
  const provider = createProviderContentScript({
    sessionId: "session-1",
    providerInfo,
  });
  expect(() => new Function(provider)).not.toThrow();
  expect(provider).not.toContain("origin:");
  const target = { sessionId: "session-1", documentId: "document-1" };
  expect(
    () =>
      new Function(createBridgeResponseScript(target, { id: 1, result: "0x1" }))
  ).not.toThrow();
  expect(
    () => new Function(createBridgeEventScript(target, "chainChanged", ["0x1"]))
  ).not.toThrow();
});

test("installs a provider and binds requests to a document session", async () => {
  const messages: string[] = [];
  const listeners: Record<string, (event: { data: string }) => void> = {};
  const announcements: Array<{
    detail: {
      info: { uuid: string; name: string; icon: string; rdns: string };
      provider: unknown;
    };
  }> = [];
  const page = {
    ReactNativeWebView: {
      postMessage: (value: string) => messages.push(value),
    },
    addEventListener: (
      event: string,
      listener: (value: { data: string }) => void
    ) => {
      listeners[event] = listener;
    },
    crypto: {
      getRandomValues: (values: Uint32Array | Uint8Array) => {
        values.set([1, 2, 3, 4]);
        return values;
      },
    },
    CustomEvent: class {
      type: string;
      detail: unknown;

      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent: (event: {
      type: string;
      detail: {
        info: { uuid: string; name: string; icon: string; rdns: string };
        provider: unknown;
      };
    }) => {
      if (event.type === "eip6963:announceProvider") {
        announcements.push(event);
      }
      return true;
    },
  } as unknown as Window & {
    ethereum: { request(args: { method: string }): Promise<unknown> };
  };
  new Function(
    "window",
    createProviderContentScript({ sessionId: "session-1", providerInfo })
  )(page);
  expect(announcements).toHaveLength(1);
  expect(announcements[0]?.detail.info).toMatchObject(providerInfo);
  expect(announcements[0]?.detail.info.uuid).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  expect(announcements[0]?.detail.provider).toBe(page.ethereum);
  listeners["eip6963:requestProvider"]?.({ data: "" });
  expect(announcements).toHaveLength(2);
  const pending = page.ethereum.request({ method: "eth_chainId" });
  const request = JSON.parse(messages[0] as string) as {
    sessionId: string;
    documentId: string;
    id: number;
  };
  expect(request.sessionId).toBe("session-1");
  expect(request.documentId).toBe("00000001000000020000000300000004");
  listeners.__ruban_rpc_response__?.({
    data: JSON.stringify({
      sessionId: request.sessionId,
      documentId: request.documentId,
      id: request.id,
      result: "0x1",
    }),
  });
  await expect(pending).resolves.toBe("0x1");
});

test("requires safe EIP-6963 provider metadata", () => {
  expect(() =>
    createProviderContentScript({
      sessionId: "session-1",
      providerInfo: { ...providerInfo, icon: "https://example.com/icon.svg" },
    })
  ).toThrow("base64 PNG, WebP, or SVG data URI");
  expect(() =>
    createProviderContentScript({
      sessionId: "session-1",
      providerInfo: { ...providerInfo, rdns: "not a reverse name" },
    })
  ).toThrow("valid reverse DNS name");
});

test("rejects a missing document session", () => {
  expect(() =>
    parseDappBridgeMessage(
      JSON.stringify({
        channel: "ruban-eip1193-v1",
        sessionId: "session-1",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      "session-1"
    )
  ).toThrow("Invalid bridge document");
});

test("rejects replayed and stale-document requests", () => {
  const host = new DappBridgeHostSession("session-1");
  const message = JSON.stringify({
    channel: "ruban-eip1193-v1",
    sessionId: "session-1",
    documentId: "document-1",
    id: 1,
    method: "eth_chainId",
    params: [],
  });
  const request = host.parse(message);
  host.complete(request);
  expect(() => host.parse(message)).toThrow("Duplicate bridge request");
  expect(() =>
    host.parse(
      JSON.stringify({
        ...JSON.parse(message),
        documentId: "document-2",
        id: 2,
      })
    )
  ).toThrow("Stale bridge document");

  host.beginNavigation();
  expect(
    host.parse(
      JSON.stringify({
        ...JSON.parse(message),
        documentId: "document-2",
      })
  ).documentId
  ).toBe("document-2");
});

test("parses a bounded deep-link DApp test command", () => {
  expect(
    parseDappTestQuery({
      runId: "request-accounts-1",
      method: "eth_requestAccounts",
      params: "[]",
      timeoutMs: "45000",
    })
  ).toEqual({
    runId: "request-accounts-1",
    method: "eth_requestAccounts",
    params: [],
    timeoutMs: 45000,
  });
  expect(() =>
    parseDappTestQuery({
      runId: "bad run",
      method: "eth_chainId",
      params: "{}",
    })
  ).toThrow(DappBridgeProtocolError);
});

test("executes one provider request and reports its result", async () => {
  const messages: string[] = [];
  const page = {
    ethereum: {
      request: jest.fn().mockResolvedValue("0x1"),
    },
    ReactNativeWebView: {
      postMessage: (value: string) => messages.push(value),
    },
  };
  const script = createDappTestCommandScript({
    runId: "chain-id-1",
    method: "eth_chainId",
    params: [],
    timeoutMs: 1000,
  });
  new Function("window", "setTimeout", "clearTimeout", script)(
    page,
    setTimeout,
    clearTimeout
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(page.ethereum.request).toHaveBeenCalledWith({
    method: "eth_chainId",
    params: [],
  });
  expect(parseDappTestResultMessage(messages[0] as string, "chain-id-1"))
    .toMatchObject({
      runId: "chain-id-1",
      method: "eth_chainId",
      status: "passed",
      result: "0x1",
    });
});

test("ignores unrelated page messages and rejects stale test results", () => {
  expect(parseDappTestResultMessage('{"hello":"world"}', "run-1")).toBeNull();
  expect(() =>
    parseDappTestResultMessage(
      JSON.stringify({
        channel: "ruban-dapp-test-v1",
        runId: "old-run",
        method: "eth_chainId",
        status: "passed",
        result: "0x1",
      }),
      "run-1"
    )
  ).toThrow("Stale DApp test result");
});
