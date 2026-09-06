import {NativeEventEmitter, NativeModules} from 'react-native';

import type {NativeWorkerTransport} from './internal/transport';

const NATIVE_MODULE_NAME = 'RubanWorkerThread';
const NATIVE_EVENT_NAME = 'rubanWorkerThreadEvent';

type NativeWorkerThreadModule = {
  create(request: string): Promise<string>;
  postMessage(workerId: string, message: string): Promise<void>;
  terminate(workerId: string): Promise<void>;
};

function isNativeModule(value: unknown): value is NativeWorkerThreadModule {
  if (!value || typeof value !== 'object') return false;
  const module = value as Record<string, unknown>;
  return ['create', 'postMessage', 'terminate'].every(key => typeof module[key] === 'function');
}

export function getNativeWorkerTransport(): NativeWorkerTransport {
  const nativeModule: unknown = NativeModules[NATIVE_MODULE_NAME];
  if (!isNativeModule(nativeModule)) {
    throw new Error(
      `${NATIVE_MODULE_NAME} is not installed. Link the native package before creating a worker; the package never falls back to the main JavaScript runtime.`,
    );
  }

  const emitter = new NativeEventEmitter(nativeModule as never);
  return {
    create: request => nativeModule.create(request),
    postMessage: (workerId, message) => nativeModule.postMessage(workerId, message),
    terminate: workerId => nativeModule.terminate(workerId),
    subscribe(listener) {
      const subscription = emitter.addListener(NATIVE_EVENT_NAME, value => {
        const event = value as {payload?: unknown};
        if (typeof event.payload === 'string') listener(event.payload);
      });
      return () => subscription.remove();
    },
  };
}
