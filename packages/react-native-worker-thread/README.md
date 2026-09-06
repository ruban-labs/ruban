# @ruban-labs/react-native-worker-thread

Bounded, named worker-runtime foundation for bare React Native.

The package defines the stable JSON transport, capability boundary, queue
limits, worker entry API, and native core lifecycle contract. It does not fall
back to the main JavaScript runtime. Hermes bundle execution and Inspector
registration are explicit follow-up phases; until an adapter is linked, native
creation rejects with `E_ENGINE_NOT_READY`.

```ts
import {WorkerThread} from '@ruban-labs/react-native-worker-thread';

const worker = await WorkerThread.create({
  name: 'account-hash',
  bundle: {id: 'com.example.wallet.account-hash'},
  capabilities: ['log'],
});

worker.addEventListener('message', event => console.log(event.data));
await worker.postMessage({accountId: '0x1234'});
await worker.terminate();
```

Worker entries import the dedicated subpath:

```ts
import {self} from '@ruban-labs/react-native-worker-thread/worker';

self.onmessage = event => {
  self.postMessage({echo: event.data});
};
```

See the repository [worker runtime architecture](../../docs/architecture/worker-runtime.md)
for the support matrix, limits, Metro/Inspector separation, and delivery plan.
