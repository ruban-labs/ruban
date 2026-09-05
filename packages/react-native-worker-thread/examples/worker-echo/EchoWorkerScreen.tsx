import React from 'react';
import {Button, Text, View} from 'react-native';
import {WorkerThread} from '@ruban-labs/react-native-worker-thread';

export function EchoWorkerScreen(): React.ReactElement {
  const [result, setResult] = React.useState('idle');

  const runEcho = React.useCallback(async () => {
    const worker = await WorkerThread.create({
      name: 'echo-demo',
      bundle: {id: 'com.ruban.examples.worker-echo'},
      capabilities: ['log'],
    });
    const remove = worker.addEventListener('message', event => setResult(JSON.stringify(event.data)));
    try {
      await worker.postMessage({hello: 'worker'});
    } finally {
      remove();
      await worker.terminate();
    }
  }, []);

  return (
    <View>
      <Button title="Run worker echo" onPress={() => void runEcho()} />
      <Text>{result}</Text>
    </View>
  );
}
