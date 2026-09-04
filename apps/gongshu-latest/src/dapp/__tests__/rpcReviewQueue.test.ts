import {RpcReviewError, RpcReviewQueue, type RpcReviewRequest} from '../rpcReviewQueue';

function request(id: string, sessionId = 'session-1'): RpcReviewRequest {
  return {
    id,
    sessionId,
    kind: 'connect',
    method: 'eth_requestAccounts',
    title: 'Connect account',
    origin: 'https://example.com',
    rows: [],
  };
}

test('reviews requests in FIFO order', async () => {
  const queue = new RpcReviewQueue();
  const first = queue.request(request('first'));
  const second = queue.request(request('second'));

  expect(queue.getActive()?.id).toBe('first');
  queue.approve();
  await expect(first).resolves.toBeUndefined();
  expect(queue.getActive()?.id).toBe('second');
  queue.reject();
  await expect(second).rejects.toMatchObject({code: 4001});
  expect(queue.getActive()).toBeNull();
});

test('cancels only requests from the changed DApp session', async () => {
  const queue = new RpcReviewQueue();
  const first = queue.request(request('first', 'session-1'));
  const second = queue.request(request('second', 'session-2'));
  const third = queue.request(request('third', 'session-1'));

  queue.cancelSession('session-1');
  await expect(first).rejects.toMatchObject({code: 4001});
  await expect(third).rejects.toMatchObject({code: 4001});
  expect(queue.getActive()?.id).toBe('second');
  queue.approve();
  await expect(second).resolves.toBeUndefined();
});

test('rejects duplicate and overflowing requests', async () => {
  const queue = new RpcReviewQueue(1);
  const pending = queue.request(request('first'));

  await expect(queue.request(request('first'))).rejects.toEqual(
    new RpcReviewError(-32002, 'Provider request is already pending'),
  );
  await expect(queue.request(request('second'))).rejects.toMatchObject({
    code: -32005,
  });
  queue.reject();
  await expect(pending).rejects.toMatchObject({code: 4001});
});
