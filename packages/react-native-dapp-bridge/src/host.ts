export type DappBridgeRequest = {
  channel: "ruban-eip1193-v1";
  sessionId: string;
  documentId: string;
  id: number;
  method: string;
  params: unknown[];
};

export type DappBridgeError = {
  code: number;
  message: string;
};

export type DappBridgeTarget = Pick<
  DappBridgeRequest,
  "sessionId" | "documentId"
>;

export class DappBridgeProtocolError extends Error {}

export class DappBridgeHostSession {
  private activeDocumentId: string | null;
  private readonly pendingIds: Set<number>;
  private readonly seenIds: Set<number>;
  private readonly maxPendingRequests: number;
  private readonly maxRequestsPerDocument: number;

  constructor(
    readonly sessionId: string,
    options: {
      maxPendingRequests?: number;
      maxRequestsPerDocument?: number;
    } = {}
  ) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
      throw new DappBridgeProtocolError("Invalid host bridge session");
    }
    this.activeDocumentId = null;
    this.pendingIds = new Set<number>();
    this.seenIds = new Set<number>();
    this.maxPendingRequests = normalizeLimit(options.maxPendingRequests, 32);
    this.maxRequestsPerDocument = normalizeLimit(
      options.maxRequestsPerDocument,
      4096
    );
  }

  beginNavigation(): void {
    this.activeDocumentId = null;
    this.pendingIds.clear();
    this.seenIds.clear();
  }

  parse(raw: string): DappBridgeRequest {
    const request = parseDappBridgeMessage(raw, this.sessionId);
    if (this.activeDocumentId === null)
      this.activeDocumentId = request.documentId;
    if (request.documentId !== this.activeDocumentId) {
      throw new DappBridgeProtocolError("Stale bridge document");
    }
    if (this.seenIds.has(request.id)) {
      throw new DappBridgeProtocolError("Duplicate bridge request");
    }
    if (this.pendingIds.size >= this.maxPendingRequests) {
      throw new DappBridgeProtocolError("Too many pending bridge requests");
    }
    if (this.seenIds.size >= this.maxRequestsPerDocument) {
      throw new DappBridgeProtocolError(
        "Bridge document request limit reached"
      );
    }
    this.seenIds.add(request.id);
    this.pendingIds.add(request.id);
    return request;
  }

  complete(request: DappBridgeRequest): void {
    if (
      request.sessionId === this.sessionId &&
      request.documentId === this.activeDocumentId
    ) {
      this.pendingIds.delete(request.id);
    }
  }
}

export function parseDappBridgeMessage(
  raw: string,
  expectedSessionId: string
): DappBridgeRequest {
  if (raw.length > 65536)
    throw new DappBridgeProtocolError("Bridge message is too large");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new DappBridgeProtocolError("Bridge message is not valid JSON");
  }
  if (!isRecord(value))
    throw new DappBridgeProtocolError("Bridge message must be an object");
  if (value.channel !== "ruban-eip1193-v1")
    throw new DappBridgeProtocolError("Unknown bridge channel");
  if (value.sessionId !== expectedSessionId)
    throw new DappBridgeProtocolError("Stale bridge session");
  if (
    typeof value.documentId !== "string" ||
    !/^[a-zA-Z0-9-]{8,128}$/.test(value.documentId)
  ) {
    throw new DappBridgeProtocolError("Invalid bridge document");
  }
  if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0)
    throw new DappBridgeProtocolError("Invalid bridge request id");
  if (
    typeof value.method !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(value.method)
  ) {
    throw new DappBridgeProtocolError("Invalid provider method");
  }
  if (!Array.isArray(value.params))
    throw new DappBridgeProtocolError("Provider params must be an array");
  return value as DappBridgeRequest;
}

export function createBridgeResponseScript(
  target: DappBridgeTarget,
  response: { id: number; result?: unknown; error?: DappBridgeError }
): string {
  return dispatchScript(JSON.stringify({ ...target, ...response }));
}

export function createBridgeEventScript(
  target: DappBridgeTarget,
  event: string,
  args: unknown[]
): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(event))
    throw new DappBridgeProtocolError("Invalid provider event");
  return dispatchScript(JSON.stringify({ ...target, event, args }));
}

function dispatchScript(payload: string): string {
  return `window.dispatchEvent(new MessageEvent('__ruban_rpc_response__',{data:${JSON.stringify(
    payload
  )}}));true;`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}
