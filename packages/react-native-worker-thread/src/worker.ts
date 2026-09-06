import {parseJson, serializeJson} from './internal/json';
import type {JsonValue, WorkerEventListener, WorkerSubscription} from './types';

type WorkerPort = {
  postMessage(message: string): void;
};

type WorkerRuntimeGlobal = typeof globalThis & {
  __rubanWorkerThreadPort?: WorkerPort;
  __rubanWorkerThreadDispatch?: (message: string) => void;
};

export type WorkerScopeMessageEvent = {
  readonly type: 'message';
  readonly data: JsonValue;
};

const runtimeGlobal = globalThis as WorkerRuntimeGlobal;
const messageListeners = new Set<WorkerEventListener<WorkerScopeMessageEvent>>();
let onmessage: WorkerEventListener<WorkerScopeMessageEvent> | undefined;

function requirePort(): WorkerPort {
  const port = runtimeGlobal.__rubanWorkerThreadPort;
  if (!port || typeof port.postMessage !== 'function') {
    throw new Error('This worker entry was started without the Ruban worker runtime port');
  }
  return port;
}

export const self = {
  get onmessage(): WorkerEventListener<WorkerScopeMessageEvent> | undefined {
    return onmessage;
  },
  set onmessage(listener: WorkerEventListener<WorkerScopeMessageEvent> | undefined) {
    onmessage = listener;
  },
  postMessage(value: JsonValue): void {
    requirePort().postMessage(serializeJson(value));
  },
  addEventListener(type: 'message', listener: WorkerEventListener<WorkerScopeMessageEvent>): WorkerSubscription {
    if (type !== 'message') throw new Error(`Unsupported worker event type: ${type}`);
    messageListeners.add(listener);
    return () => messageListeners.delete(listener);
  },
};

runtimeGlobal.__rubanWorkerThreadDispatch = (message: string) => {
  const event: WorkerScopeMessageEvent = {type: 'message', data: parseJson(message)};
  if (onmessage) onmessage(event);
  for (const listener of messageListeners) listener(event);
};
