# React Native Worker Runtime

## Terminal state

`@ruban-labs/react-native-worker-thread` owns named, independently scheduled
workers. Each worker has one native thread, one JavaScript runtime, one bundle
entry, bounded inbound and outbound byte queues, and an explicit terminal
lifecycle. A worker exchanges serialized messages only: no `jsi::Value`, host
object, React context, or NativeModule is shared between runtimes.

The base package is bare React Native and defaults to Hermes. A future V8
adapter is an optional engine integration; it must not add V8 binaries to the
base package. Worker bundles and Inspector targets are separate systems:
Metro makes code available to a runtime, while Inspector registration makes a
runtime discoverable by a debugger. One does not imply the other.

## Why the boundary is explicit

The implementation is designed after auditing existing runtime approaches,
their licenses, bundle loading paths, and the React Native Inspector contracts.
The result is an independent implementation. It avoids a second full
application bridge as the worker abstraction, synchronous bundle downloads,
implicit access to all application native modules, and transport of
engine-owned values.

React Native's current Inspector integration registers a runtime under a host
target and supplies an executor that always schedules work on that runtime.
That lifecycle is distinct from obtaining an entry bundle from Metro. Older
React Native releases expose different inspector internals, so Inspector
support is version-adapted and never inferred merely because a bundle loaded.

## Public contract

The stable TypeScript surface in the foundation package is intentionally small:

```ts
const worker = await WorkerThread.create({
  name: 'hash-account-42',
  bundle: {id: 'com.example.wallet.hash-worker'},
  capabilities: ['log'],
  limits: {
    maxQueueDepth: 128,
    maxMessageBytes: 1_048_576,
  },
});

worker.addEventListener('message', event => {
  console.log(event.data);
});

await worker.postMessage({kind: 'hash', payload: '0x…'});
await worker.terminate();
```

The corresponding worker entry imports the `./worker` subpath. It exposes only
`postMessage`, message listeners, and its configured capabilities; it does not
import the app's `NativeModules` object.

Version 1 transports JSON values. JSON is serialized before it crosses the
native boundary and decoded after it arrives. The envelope reserves a version
and flags so a later version can add request IDs, cancellation, transferable
ArrayBuffers, and worker-pool scheduling without changing this API shape.

## Limits and cleanup

The JavaScript-facing API validates the option envelope and each message body;
the native core owns queue admission and byte accounting. The defaults are
deliberately conservative:

| Boundary | Default | Behaviour at limit |
| --- | ---: | --- |
| Concurrent workers per owner | 4 | creation is rejected |
| Stable worker name | 64 ASCII identifier characters | creation is rejected |
| Inbound/outbound queue depth | 128 messages each | send is rejected |
| Message body | 1 MiB UTF-8 | send is rejected |
| Bytes retained by either queue | 4 MiB | send is rejected |
| Worker runtime budget | 5 minutes | engine adapter is asked to interrupt and terminate |
| Graceful shutdown | 1 second | runtime is invalidated and resources are released |

The C++ core owns queue admission, byte accounting, terminal state, and its
dedicated thread. It owns no JSI object. A running engine callback receives a
deadline plus a cooperative `shouldStop()` check; C++ must not force-kill an
arbitrary native thread, because that could tear down engine-owned state while
it is in use. Platform adapters therefore interrupt their runtime through that
check and may acknowledge termination only after joining the thread. App
background, bridge invalidation, uncaught worker errors, timeout, and explicit
`terminate()` all converge on that path. A worker that is already terminal
cannot accept another message or restart under the same ID.

The foundation core has a deterministic C++ echo smoke that proves queue
limits, thread exit, and disposal without a device. The sample worker is a real
worker entry and the TypeScript harness proves the JSON protocol. The device
runner is only declared supported after the relevant platform adapter passes
its native matrix; the package does not silently fall back to the main
JavaScript runtime.

## Capabilities

Workers start with no application NativeModules. A bundle may request only
named capabilities from this allowlist:

- `log`
- `timers`
- `network`
- `sqlite`
- `native-rpc`

The host application grants a subset at creation time, and a platform adapter
installs only that subset into the worker runtime. Capability installation is
asynchronous and message-based where it touches the app runtime. It never
passes a JSI object between runtimes. `network`, `sqlite`, and `native-rpc` are
policy names, not implicit permissions; each application supplies its own
bounded implementation and authorization.

## Native layout

```text
TypeScript client ── JSON envelope ── NativeModule / TurboModule adapter
                                         │
                                         ▼
                                 C++ WorkerRuntime core
                                (thread, state, byte queues)
                                         │
                         engine adapter on that worker thread
                        ┌────────────────┴────────────────┐
                        │                                 │
                   Hermes adapter                    optional V8 adapter
                        │                                 │
                   bundle loader                  bundle loader
                        │
                   worker entry
```

The C++ core is the shared boundary for Android and iOS. Old Architecture will
use a NativeModule adapter; New Architecture will use a TurboModule adapter
with the same JSON wire contract and the same core. The platform adapter is the
only layer allowed to see a `jsi::Runtime`, and it may use it only on the
worker's own thread.

## Metro and bundle ownership

Each worker has a stable `bundle.id`, chosen by the app. The production bundle
tool produces one platform-specific asset per ID; development requests the
matching Metro entry with source maps. The bundle manifest records only the
ID, platform, build mode, byte size, and content hash. A worker loader never
accepts an arbitrary URL from JavaScript.

This foundation PR supplies the entry contract and echo fixture. The actual
Metro asset generation and platform loaders are the Hermes execution phase.
Their acceptance test is a release asset, a development Metro response, and
the same echo source map on both Android and iOS.

## Inspector is a separate phase

In development, every worker must eventually register as its own Inspector
runtime target with a stable target name such as `worker:hash-account-42`. The
adapter will register after runtime creation and before executing the bundle,
schedule Inspector work exclusively via the worker executor, and unregister
before destroying the runtime. Its test must prove discovery, breakpoints,
logs, and source-map resolution.

The current foundation deliberately does **not** claim Inspector support. It
contains no pretend target registration and never treats Metro success as
debugger success.

## Compatibility and staged delivery

| React Native era | Architecture | Foundation status | Hermes execution | Inspector target |
| --- | --- | --- | --- | --- |
| 0.66 | Old Architecture | TS contract + legacy bridge package shape | adapter phase | separate legacy adapter phase |
| 0.77 | Old Architecture | TS contract + bridge package shape | adapter phase | version adapter phase |
| 0.77 | New Architecture | TS contract + codegen boundary reserved | adapter phase | version adapter phase |
| latest | Old Architecture, if supported by RN | TS contract + bridge package shape | adapter phase | version adapter phase |
| latest | New Architecture | TS contract + codegen boundary reserved | adapter phase | version adapter phase |

All Gongshu samples use Hermes. The foundation's typecheck and Metro consumer
fixtures cover 0.66, 0.77, and latest. Native compilation is enabled only for
cells where an adapter is present; a missing adapter is an explicit
`E_ENGINE_NOT_READY` error, never a main-thread fallback.

### Delivery phases

1. **Foundation (this change):** stable JSON API, worker entry API, C++
   lifecycle/queue kernel, echo protocol smoke, package/pod/Gradle shape,
   matrix fixtures, and documented limits.
2. **Hermes execution:** one `HermesRuntime` per worker native thread,
   platform bundle loaders, lifecycle interruption, and device echo smoke.
3. **Inspector:** RN-version adapters that register and unregister a target
   independently of Metro, plus debugger/source-map validation.
4. **Capabilities and RPC:** host-owned timer/log/network/sqlite/native-RPC
   adapters, request IDs, cancellation, and bounded worker pools.
5. **Optional engines:** a separately packaged V8 adapter behind the same
   engine interface and compatibility tests. It is never pulled by default.

## Verification required before an adapter is declared ready

- A real app starts two named workers with different bundle IDs.
- JSON round trips preserve `null`, nested arrays, and Unicode; oversized,
  circular, non-finite, and queue-overflow values are rejected.
- Explicit terminate, bundle exception, deadline, background/destroy, and
  bridge invalidation each invoke the engine's cooperative interruption and
  release the thread/runtime exactly once.
- A repeated start/send/terminate soak has no retained worker, pending queue,
  or active native thread after cooldown.
- Both platform native builds and the era-specific consumer typecheck/Metro
  smoke pass.
- Inspector acceptance proves target discovery and source maps separately from
  bundle loading.
