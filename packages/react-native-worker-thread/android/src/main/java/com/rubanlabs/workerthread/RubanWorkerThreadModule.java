package com.rubanlabs.workerthread;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * The bridge is intentionally terminal: it rejects until the Hermes adapter is
 * linked. It must never execute a worker bundle on the main JS runtime.
 */
public final class RubanWorkerThreadModule extends ReactContextBaseJavaModule {
  static final String NAME = "RubanWorkerThread";

  RubanWorkerThreadModule(ReactApplicationContext context) {
    super(context);
  }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void create(String request, Promise promise) {
    promise.reject(
      "E_ENGINE_NOT_READY",
      "The Hermes worker adapter is not linked in this foundation release. Main-thread fallback is disabled."
    );
  }

  @ReactMethod
  public void postMessage(String workerId, String message, Promise promise) {
    promise.reject(
      "E_ENGINE_NOT_READY",
      "The Hermes worker adapter is not linked in this foundation release."
    );
  }

  @ReactMethod
  public void terminate(String workerId, Promise promise) {
    promise.resolve(null);
  }

  @ReactMethod
  public void addListener(String eventName) {
    // Required by NativeEventEmitter and TurboModule-compatible event shape.
  }

  @ReactMethod
  public void removeListeners(double count) {
    // Required by NativeEventEmitter and TurboModule-compatible event shape.
  }
}
