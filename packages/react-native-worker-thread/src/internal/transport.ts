export type NativeWorkerTransport = {
  create(request: string): Promise<string>;
  postMessage(workerId: string, message: string): Promise<void>;
  terminate(workerId: string): Promise<void>;
  subscribe(listener: (event: string) => void): () => void;
};
