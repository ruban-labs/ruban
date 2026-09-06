export type RpcReviewKind =
  | 'connect'
  | 'switch-chain'
  | 'personal-sign'
  | 'typed-sign'
  | 'send-transaction';

export type RpcReviewRow = {
  label: string;
  value: string;
  emphasis?: 'normal' | 'warning';
};

export type RpcReviewRequest = {
  id: string;
  sessionId: string;
  kind: RpcReviewKind;
  method: string;
  title: string;
  origin: string;
  account?: string;
  chainName?: string;
  badge?: string;
  rows: readonly RpcReviewRow[];
  payload?: string;
  approveLabel?: string;
};

export class RpcReviewError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'RpcReviewError';
    this.code = code;
  }
}

type PendingReview = {
  request: RpcReviewRequest;
  resolve: () => void;
  reject: (error: RpcReviewError) => void;
};

type Listener = () => void;

export class RpcReviewQueue {
  private active: PendingReview | null = null;
  private readonly queued: PendingReview[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly ids = new Set<string>();

  constructor(private readonly maxSize = 8) {}

  readonly getActive = (): RpcReviewRequest | null =>
    this.active?.request ?? null;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  request(request: RpcReviewRequest): Promise<void> {
    if (this.ids.has(request.id)) {
      return Promise.reject(
        new RpcReviewError(-32002, 'Provider request is already pending'),
      );
    }
    if (this.ids.size >= this.maxSize) {
      return Promise.reject(
        new RpcReviewError(-32005, 'Provider review queue is full'),
      );
    }

    return new Promise<void>((resolve, reject) => {
      this.ids.add(request.id);
      this.queued.push({request, resolve, reject});
      this.advance();
    });
  }

  approve(): void {
    this.settleActive(true, new RpcReviewError(4001, 'Request rejected'));
  }

  reject(message = 'Request rejected'): void {
    this.settleActive(false, new RpcReviewError(4001, message));
  }

  cancelSession(sessionId: string): void {
    const cancellation = new RpcReviewError(
      4001,
      'Request cancelled because the DApp session changed',
    );
    let changed = false;

    if (this.active?.request.sessionId === sessionId) {
      const current = this.active;
      this.active = null;
      this.ids.delete(current.request.id);
      current.reject(cancellation);
      changed = true;
    }

    for (let index = this.queued.length - 1; index >= 0; index -= 1) {
      const pending = this.queued[index];
      if (pending?.request.sessionId !== sessionId) continue;
      this.queued.splice(index, 1);
      this.ids.delete(pending.request.id);
      pending.reject(cancellation);
      changed = true;
    }

    if (changed) this.advance();
  }

  dispose(): void {
    const cancellation = new RpcReviewError(
      4001,
      'Request cancelled because the review surface closed',
    );
    const pending = this.active
      ? [this.active, ...this.queued]
      : [...this.queued];
    this.active = null;
    this.queued.length = 0;
    this.ids.clear();
    pending.forEach(item => item.reject(cancellation));
    this.emit();
  }

  private settleActive(approved: boolean, error: RpcReviewError): void {
    if (!this.active) return;
    const current = this.active;
    this.active = null;
    this.ids.delete(current.request.id);
    if (approved) current.resolve();
    else current.reject(error);
    this.advance();
  }

  private advance(): void {
    if (!this.active) this.active = this.queued.shift() ?? null;
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const appRpcReviewQueue = new RpcReviewQueue();
