import {createWorkerWithTransport, type NativeWorkerTransport} from '../testing';
import type {JsonValue, WorkerOptions} from '../types';

class EchoTransport implements NativeWorkerTransport {
  private listener: ((event: string) => void) | undefined;
  private nextId = 1;
  private readonly workers = new Set<string>();

  async create(request: string): Promise<string> {
    const parsed = JSON.parse(request) as {name: string};
    const workerId = `worker-${this.nextId++}`;
    this.workers.add(workerId);
    return JSON.stringify({workerId, name: parsed.name});
  }

  async postMessage(workerId: string, message: string): Promise<void> {
    if (!this.workers.has(workerId)) throw new Error('worker not found');
    this.listener?.(JSON.stringify({type: 'message', workerId, message}));
  }

  async terminate(workerId: string): Promise<void> {
    if (!this.workers.delete(workerId)) return;
    this.listener?.(JSON.stringify({type: 'stopped', workerId}));
  }

  subscribe(listener: (event: string) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = undefined;
    };
  }

  fail(workerId: string, code: string, message: string): void {
    this.listener?.(JSON.stringify({type: 'error', workerId, code, message}));
  }
}

class RejectingTerminateTransport extends EchoTransport {
  async terminate(): Promise<void> {
    throw new Error('native shutdown did not complete');
  }
}

function options(name: string, limits?: WorkerOptions['limits']): WorkerOptions {
  return {
    name,
    bundle: {id: `com.ruban.test.${name}`},
    capabilities: ['log'],
    limits,
  };
}

describe('WorkerThread JSON transport', () => {
  it('runs the deterministic echo protocol and terminates cleanly', async () => {
    const transport = new EchoTransport();
    const worker = await createWorkerWithTransport(options('echo-contract'), transport);
    const received: JsonValue[] = [];
    const remove = worker.addEventListener('message', event => received.push(event.data));

    await worker.postMessage({kind: 'echo', nested: ['你好', null, 42]});

    expect(received).toEqual([{kind: 'echo', nested: ['你好', null, 42]}]);
    expect(worker.state).toBe('running');
    remove();
    await worker.terminate();
    expect(worker.state).toBe('terminated');
    await expect(worker.postMessage({after: 'terminate'})).rejects.toMatchObject({name: 'E_WORKER_NOT_RUNNING'});
  });

  it('rejects an oversized JSON message before it reaches native code', async () => {
    const transport = new EchoTransport();
    const worker = await createWorkerWithTransport(options('message-bound', {maxMessageBytes: 16, maxQueueBytes: 16}), transport);

    await expect(worker.postMessage({payload: 'this cannot fit'})).rejects.toMatchObject({name: 'E_MESSAGE_TOO_LARGE'});
    await worker.terminate();
  });

  it('owns stable names and releases them after termination', async () => {
    const transport = new EchoTransport();
    const first = await createWorkerWithTransport(options('unique-name'), transport);
    await expect(createWorkerWithTransport(options('unique-name'), transport)).rejects.toMatchObject({name: 'E_DUPLICATE_NAME'});
    await first.terminate();

    const replacement = await createWorkerWithTransport(options('unique-name'), transport);
    await replacement.terminate();
  });

  it('rejects a fifth concurrent worker before native allocation', async () => {
    const transport = new EchoTransport();
    const workers = await Promise.all(
      ['worker-a', 'worker-b', 'worker-c', 'worker-d'].map(name => createWorkerWithTransport(options(name), transport)),
    );

    await expect(createWorkerWithTransport(options('worker-e'), transport)).rejects.toMatchObject({
      name: 'E_WORKER_LIMIT_REACHED',
    });
    await Promise.all(workers.map(worker => worker.terminate()));
  });

  it('moves to a failed terminal state on a native worker exception', async () => {
    const transport = new EchoTransport();
    const worker = await createWorkerWithTransport(options('native-exception'), transport);
    const errors: string[] = [];
    worker.addEventListener('error', event => errors.push(event.code));

    transport.fail(worker.id, 'E_WORKER_EXCEPTION', 'entry threw');

    expect(errors).toEqual(['E_WORKER_EXCEPTION']);
    expect(worker.state).toBe('failed');
  });

  it('does not report a failed native shutdown as a successful termination', async () => {
    const transport = new RejectingTerminateTransport();
    const worker = await createWorkerWithTransport(options('terminate-rejection'), transport);

    await expect(worker.terminate()).rejects.toThrow('native shutdown did not complete');
    expect(worker.state).toBe('failed');
  });
});
