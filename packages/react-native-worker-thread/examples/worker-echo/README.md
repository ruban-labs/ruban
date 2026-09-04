# Worker echo sample

`echo.worker.ts` is a separate worker entry. Its manifest key is
`com.ruban.examples.worker-echo`; a Hermes adapter maps that key to a
platform-specific Metro or release asset bundle.

The package test suite runs the same JSON echo protocol against the deterministic
transport and native C++ queue core. `EchoWorkerScreen.tsx` is the device-facing
consumer sample to enable once the platform Hermes adapter is linked. It does
not use or permit a main-thread fallback.
