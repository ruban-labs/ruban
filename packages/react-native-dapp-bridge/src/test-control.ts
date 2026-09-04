import { DappBridgeProtocolError } from "./host";

export const DAPP_TEST_CHANNEL = "ruban-dapp-test-v1";

export type DappTestCommand = {
  runId: string;
  method: string;
  params: readonly unknown[];
  timeoutMs: number;
};

export type DappTestResult = {
  channel: typeof DAPP_TEST_CHANNEL;
  runId: string;
  method: string;
  status: "passed" | "failed";
  result?: unknown;
  error?: {
    code?: number;
    message: string;
  };
};

export function parseDappTestQuery(
  query: Record<string, unknown>
): DappTestCommand {
  const runId = requireSingleString(query.runId, "runId");
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(runId)) {
    throw new DappBridgeProtocolError("Invalid DApp test runId");
  }

  const method = requireSingleString(query.method, "method");
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(method)) {
    throw new DappBridgeProtocolError("Invalid DApp test method");
  }

  const paramsText = optionalSingleString(query.params, "params") || "[]";
  if (paramsText.length > 16384) {
    throw new DappBridgeProtocolError("DApp test params are too large");
  }

  let params: unknown;
  try {
    params = JSON.parse(paramsText);
  } catch {
    throw new DappBridgeProtocolError("DApp test params must be valid JSON");
  }
  if (!Array.isArray(params)) {
    throw new DappBridgeProtocolError("DApp test params must be an array");
  }

  const timeoutText = optionalSingleString(query.timeoutMs, "timeoutMs");
  const timeoutMs = timeoutText == null ? 30000 : Number(timeoutText);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 60000
  ) {
    throw new DappBridgeProtocolError(
      "DApp test timeoutMs must be between 1000 and 60000"
    );
  }

  return { runId, method, params, timeoutMs };
}

export function createDappTestCommandScript(
  command: DappTestCommand
): string {
  const normalized = parseDappTestQuery({
    runId: command.runId,
    method: command.method,
    params: JSON.stringify(command.params),
    timeoutMs: String(command.timeoutMs),
  });
  const commandJson = JSON.stringify(normalized);
  const channelJson = JSON.stringify(DAPP_TEST_CHANNEL);

  return `;(function(){var command=${commandJson};var channel=${channelJson};var settled=false;var timer=null;function post(payload){if(settled)return;settled=true;if(timer)clearTimeout(timer);var message;try{message=JSON.stringify(payload);if(message.length>32768)throw new Error('DApp test result is too large');}catch(error){message=JSON.stringify({channel:channel,runId:command.runId,method:command.method,status:'failed',error:{message:error&&error.message?error.message:'DApp test result is not serializable'}});}window.ReactNativeWebView.postMessage(message);}timer=setTimeout(function(){post({channel:channel,runId:command.runId,method:command.method,status:'failed',error:{message:'DApp test request timed out'}});},command.timeoutMs);Promise.resolve().then(function(){if(!window.ethereum||typeof window.ethereum.request!=='function')throw new Error('window.ethereum is unavailable');return window.ethereum.request({method:command.method,params:command.params});}).then(function(result){post({channel:channel,runId:command.runId,method:command.method,status:'passed',result:result});},function(error){var code=error&&typeof error.code==='number'?error.code:undefined;post({channel:channel,runId:command.runId,method:command.method,status:'failed',error:{code:code,message:error&&error.message?String(error.message):'Provider request failed'}});});})();true;`;
}

export function parseDappTestResultMessage(
  raw: string,
  expectedRunId: string
): DappTestResult | null {
  if (typeof raw !== "string") return null;
  if (raw.length > 65536) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.channel !== DAPP_TEST_CHANNEL) return null;
  if (value.runId !== expectedRunId) {
    throw new DappBridgeProtocolError("Stale DApp test result");
  }
  if (
    typeof value.method !== "string" ||
    !/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(value.method)
  ) {
    throw new DappBridgeProtocolError("Invalid DApp test result method");
  }
  if (value.status !== "passed" && value.status !== "failed") {
    throw new DappBridgeProtocolError("Invalid DApp test result status");
  }
  if (value.status === "failed") {
    if (!isRecord(value.error) || typeof value.error.message !== "string") {
      throw new DappBridgeProtocolError("Invalid DApp test error");
    }
    if (
      value.error.code != null &&
      (!Number.isSafeInteger(value.error.code) ||
        Math.abs(value.error.code as number) > 100000)
    ) {
      throw new DappBridgeProtocolError("Invalid DApp test error code");
    }
  }
  return value as DappTestResult;
}

function requireSingleString(value: unknown, field: string): string {
  const result = optionalSingleString(value, field);
  if (result == null || result.length === 0) {
    throw new DappBridgeProtocolError(`DApp test ${field} is required`);
  }
  return result;
}

function optionalSingleString(
  value: unknown,
  field: string
): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new DappBridgeProtocolError(`DApp test ${field} must be a string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
