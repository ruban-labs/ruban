export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonPrimitive | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export const WORKER_PROTOCOL_VERSION = 1;

export const DEFAULT_WORKER_LIMITS = {
  maxQueueDepth: 128,
  maxMessageBytes: 1024 * 1024,
  maxQueueBytes: 4 * 1024 * 1024,
  maxRuntimeMs: 5 * 60 * 1000,
  shutdownGraceMs: 1000,
} as const;

export const MAX_WORKERS_PER_OWNER = 4;

export const WORKER_CAPABILITIES = ['log', 'timers', 'network', 'sqlite', 'native-rpc'] as const;

export type WorkerCapability = (typeof WORKER_CAPABILITIES)[number];

export type WorkerEngine = 'hermes' | 'v8';

export type WorkerBundle = {
  /** A stable, application-owned bundle manifest key; it is never a URL. */
  readonly id: string;
  /** Optional build manifest hash used by a platform loader to reject drift. */
  readonly hash?: string;
};

export type WorkerLimits = {
  readonly maxQueueDepth?: number;
  readonly maxMessageBytes?: number;
  readonly maxQueueBytes?: number;
  readonly maxRuntimeMs?: number;
  readonly shutdownGraceMs?: number;
};

export type WorkerOptions = {
  readonly name: string;
  readonly bundle: WorkerBundle;
  readonly capabilities?: readonly WorkerCapability[];
  readonly limits?: WorkerLimits;
  /** Hermes is the base default. V8 remains an optional future adapter. */
  readonly engine?: WorkerEngine;
};

export type WorkerLifecycleState =
  | 'starting'
  | 'running'
  | 'terminating'
  | 'terminated'
  | 'failed';

export type WorkerMessageEvent = {
  readonly type: 'message';
  readonly target: WorkerThreadHandle;
  readonly data: JsonValue;
};

export type WorkerErrorEvent = {
  readonly type: 'error';
  readonly target: WorkerThreadHandle;
  readonly code: string;
  readonly message: string;
};

export type WorkerThreadHandle = {
  readonly id: string;
  readonly name: string;
  readonly state: WorkerLifecycleState;
};

export type WorkerSubscription = () => void;

export type WorkerEventListener<TEvent> = (event: TEvent) => void;
