import {self} from '@ruban-labs/react-native-worker-thread/worker';

self.onmessage = event => {
  self.postMessage({kind: 'echo', value: event.data});
};
