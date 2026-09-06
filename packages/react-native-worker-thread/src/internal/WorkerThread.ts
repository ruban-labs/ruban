import {parseJson, serializeJson, utf8ByteLength} from './json';
import type {NativeWorkerTransport} from './transport';
import {getNativeWorkerTransport} from '../native';
import {
  DEFAULT_WORKER_LIMITS,
  MAX_WORKERS_PER_OWNER,
  WORKER_CAPABILITIES,
  WORKER_PROTOCOL_VERSION,
  type JsonValue,
  type WorkerCapability,
  type WorkerEngine,
  type WorkerErrorEvent,
  type WorkerEventListener,
  type WorkerLifecycleState,
  type WorkerLimits,
  type WorkerMessageEvent,
  type WorkerOptions,
  type WorkerSubscription,
  type WorkerThreadHandle,
} from '../types';

type NormalizedLimits = {
  readonly [Key in keyof typeof DEFAULT_WORKER_LIMITS]: number;
};

type NativeCreateResponse = {
  readonly workerId: string;
  readonly name: string;
};

type NativeEvent =
  | {readonly type: 'message'; readonly workerId: string; readonly message: string}
  | {readonly type: 'error'; readonly workerId: string; readonly code: string; readonly message: string}
  | {readonly type: 'stopped'; readonly workerId: string};

const claimedNames = new Set<string>();
const namePattern = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

function workerError(message: string, code = 'E_WORKER_PROTOCOL'): Error {
  const error = new Error(message);
  error.name = code;
  return error;
}

function normalizeInteger(value: number | undefined, fallback: number, label: string): number {
  const result = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw workerError(`${label} must be a positive safe integer`, 'E_INVALID_LIMIT');
  }
  return result;
}

function normalizeLimits(limits: WorkerLimits | undefined): NormalizedLimits {
  const provided = limits || {};
  const normalized = {
    maxQueueDepth: normalizeInteger(provided.maxQueueDepth, DEFAULT_WORKER_LIMITS.maxQueueDepth, 'maxQueueDepth'),
    maxMessageBytes: normalizeInteger(provided.maxMessageBytes, DEFAULT_WORKER_LIMITS.maxMessageBytes, 'maxMessageBytes'),
    maxQueueBytes: normalizeInteger(provided.maxQueueBytes, DEFAULT_WORKER_LIMITS.maxQueueBytes, 'maxQueueBytes'),
    maxRuntimeMs: normalizeInteger(provided.maxRuntimeMs, DEFAULT_WORKER_LIMITS.maxRuntimeMs, 'maxRuntimeMs'),
    shutdownGraceMs: normalizeInteger(provided.shutdownGraceMs, DEFAULT_WORKER_LIMITS.shutdownGraceMs, 'shutdownGraceMs'),
  };
  if (normalized.maxQueueBytes < normalized.maxMessageBytes) {
    throw workerError('maxQueueBytes must be at least maxMessageBytes', 'E_INVALID_LIMIT');
  }
  return normalized;
}

function normalizeCapabilities(capabilities: readonly WorkerCapability[] | undefined): readonly WorkerCapability[] {
  if (!capabilities) return [];
  const unique = new Set<WorkerCapability>();
  for (const capability of capabilities) {
    if (!(WORKER_CAPABILITIES as readonly string[]).includes(capability)) {
      throw workerError(`Unsupported worker capability: ${capability}`, 'E_INVALID_CAPABILITY');
    }
    unique.add(capability);
  }
  return [...unique].sort();
}

function parseCreateResponse(payload: string, expectedName: string): NativeCreateResponse {
  const parsed = parseJson(payload);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw workerError('Native create response must be an object');
  }
  const response = parsed as Record<string, JsonValue>;
  if (typeof response.workerId !== 'string' || !response.workerId) {
    throw workerError('Native create response has no workerId');
  }
  if (response.name !== expectedName) {
    throw workerError('Native create response name does not match the requested worker');
  }
  return {workerId: response.workerId, name: expectedName};
}

function parseNativeEvent(payload: string): NativeEvent {
  const parsed = parseJson(payload);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw workerError('Native event must be an object');
  const event = parsed as Record<string, JsonValue>;
  if (typeof event.type !== 'string' || typeof event.workerId !== 'string') {
    throw workerError('Native event is missing type or workerId');
  }
  if (event.type === 'message' && typeof event.message === 'string') {
    return {type: 'message', workerId: event.workerId, message: event.message};
  }
  if (event.type === 'error' && typeof event.code === 'string' && typeof event.message === 'string') {
    return {type: 'error', workerId: event.workerId, code: event.code, message: event.message};
  }
  if (event.type === 'stopped') return {type: 'stopped', workerId: event.workerId};
  throw workerError(`Unsupported native event type: ${event.type}`);
}

export class WorkerThread implements WorkerThreadHandle {
  static async create(options: WorkerOptions): Promise<WorkerThread> {
    return createWorkerWithTransport(options, getNativeWorkerTransport());
  }

  static async createWithTransport(options: WorkerOptions, transport: NativeWorkerTransport): Promise<WorkerThread> {
    if (!namePattern.test(options.name)) {
      throw workerError('Worker names must be stable ASCII identifiers up to 64 characters', 'E_INVALID_NAME');
    }
    if (!options.bundle || !options.bundle.id || typeof options.bundle.id !== 'string') {
      throw workerError('Worker bundle.id is required', 'E_INVALID_BUNDLE');
    }
    if (claimedNames.has(options.name)) {
      throw workerError(`A worker named ${options.name} is already active`, 'E_DUPLICATE_NAME');
    }
    if (claimedNames.size >= MAX_WORKERS_PER_OWNER) {
      throw workerError('The worker owner has reached its concurrent worker limit', 'E_WORKER_LIMIT_REACHED');
    }

    const limits = normalizeLimits(options.limits);
    const capabilities = normalizeCapabilities(options.capabilities);
    const engine: WorkerEngine = options.engine === undefined ? 'hermes' : options.engine;
    claimedNames.add(options.name);

    try {
      const response = parseCreateResponse(
        await transport.create(
          serializeJson({
            protocolVersion: WORKER_PROTOCOL_VERSION,
            name: options.name,
            bundle: options.bundle,
            capabilities,
            limits,
            engine,
          }),
        ),
        options.name,
      );
      return new WorkerThread(response.workerId, response.name, limits, transport);
    } catch (error) {
      claimedNames.delete(options.name);
      throw error;
    }
  }

  readonly id: string;
  readonly name: string;
  private readonly limits: NormalizedLimits;
  private readonly transport: NativeWorkerTransport;
  private readonly messageListeners: Set<WorkerEventListener<WorkerMessageEvent>>;
  private readonly errorListeners: Set<WorkerEventListener<WorkerErrorEvent>>;
  private removeNativeSubscription: (() => void) | undefined;
  private lifecycleState: WorkerLifecycleState;
  private termination: Promise<void> | undefined;
  onmessage: WorkerEventListener<WorkerMessageEvent> | undefined;
  onerror: WorkerEventListener<WorkerErrorEvent> | undefined;

  private constructor(workerId: string, name: string, limits: NormalizedLimits, transport: NativeWorkerTransport) {
    this.id = workerId;
    this.name = name;
    this.limits = limits;
    this.transport = transport;
    this.messageListeners = new Set<WorkerEventListener<WorkerMessageEvent>>();
    this.errorListeners = new Set<WorkerEventListener<WorkerErrorEvent>>();
    this.lifecycleState = 'running';
    this.removeNativeSubscription = transport.subscribe(event => this.receiveNativeEvent(event));
  }

  get state(): WorkerLifecycleState {
    return this.lifecycleState;
  }

  addEventListener(type: 'message', listener: WorkerEventListener<WorkerMessageEvent>): WorkerSubscription;
  addEventListener(type: 'error', listener: WorkerEventListener<WorkerErrorEvent>): WorkerSubscription;
  addEventListener(
    type: 'message' | 'error',
    listener: WorkerEventListener<WorkerMessageEvent> | WorkerEventListener<WorkerErrorEvent>,
  ): WorkerSubscription {
    const listeners = type === 'message' ? this.messageListeners : this.errorListeners;
    listeners.add(listener as never);
    return () => listeners.delete(listener as never);
  }

  async postMessage(value: JsonValue): Promise<void> {
    if (this.lifecycleState !== 'running') {
      throw workerError(`Cannot postMessage while worker is ${this.lifecycleState}`, 'E_WORKER_NOT_RUNNING');
    }
    const payload = serializeJson(value);
    if (utf8ByteLength(payload) > this.limits.maxMessageBytes) {
      throw workerError('Worker message exceeds maxMessageBytes', 'E_MESSAGE_TOO_LARGE');
    }
    await this.transport.postMessage(this.id, payload);
  }

  terminate(): Promise<void> {
    if (this.termination) return this.termination;
    if (this.lifecycleState === 'terminated' || this.lifecycleState === 'failed') return Promise.resolve();
    this.lifecycleState = 'terminating';
    this.termination = this.transport
      .terminate(this.id)
      .then(
        () => this.markTerminal('terminated'),
        error => {
          this.markTerminal('failed');
          throw error;
        },
      );
    return this.termination;
  }

  private receiveNativeEvent(payload: string): void {
    let event: NativeEvent;
    try {
      event = parseNativeEvent(payload);
    } catch (error) {
      this.emitError({
        type: 'error',
        target: this,
        code: 'E_NATIVE_PROTOCOL',
        message: error instanceof Error ? error.message : 'Invalid native worker event',
      });
      return;
    }
    if (event.workerId !== this.id || this.lifecycleState === 'terminated') return;

    if (event.type === 'message') {
      try {
        const messageEvent: WorkerMessageEvent = {type: 'message', target: this, data: parseJson(event.message)};
        if (this.onmessage) this.onmessage(messageEvent);
        for (const listener of this.messageListeners) listener(messageEvent);
      } catch (error) {
        this.emitError({
          type: 'error',
          target: this,
          code: 'E_NATIVE_PROTOCOL',
          message: error instanceof Error ? error.message : 'Invalid worker message',
        });
      }
      return;
    }

    if (event.type === 'error') {
      this.lifecycleState = 'failed';
      this.emitError({type: 'error', target: this, code: event.code, message: event.message});
      this.markTerminal('failed');
      return;
    }

    this.markTerminal('terminated');
  }

  private emitError(event: WorkerErrorEvent): void {
    if (this.onerror) this.onerror(event);
    for (const listener of this.errorListeners) listener(event);
  }

  private markTerminal(state: Extract<WorkerLifecycleState, 'terminated' | 'failed'>): void {
    if (this.lifecycleState === 'terminated' && state === 'failed') return;
    this.lifecycleState = state;
    claimedNames.delete(this.name);
    if (this.removeNativeSubscription) this.removeNativeSubscription();
    this.removeNativeSubscription = undefined;
  }
}

export async function createWorkerWithTransport(options: WorkerOptions, transport: NativeWorkerTransport): Promise<WorkerThread> {
  return WorkerThread.createWithTransport(options, transport);
}
