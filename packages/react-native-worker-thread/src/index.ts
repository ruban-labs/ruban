import {WorkerThread} from './internal/WorkerThread';

export {WorkerThread};
export type {
  JsonPrimitive,
  JsonValue,
  WorkerBundle,
  WorkerCapability,
  WorkerEngine,
  WorkerErrorEvent,
  WorkerEventListener,
  WorkerLifecycleState,
  WorkerLimits,
  WorkerMessageEvent,
  WorkerOptions,
  WorkerSubscription,
  WorkerThreadHandle,
} from './types';
export {DEFAULT_WORKER_LIMITS, MAX_WORKERS_PER_OWNER, WORKER_CAPABILITIES, WORKER_PROTOCOL_VERSION} from './types';

/** Creates a native worker. It never substitutes a main-thread fallback. */
export function createWorker(options: import('./types').WorkerOptions): Promise<WorkerThread> {
  return WorkerThread.create(options);
}
