export type OverlayStrategy = 'stack' | 'replace' | 'queue';

export type OverlayHostPhase = 'idle' | 'presenting' | 'active' | 'dismissing';

export type OverlayEntry<Value> = {
  id: string;
  strategy: OverlayStrategy;
  value: Value;
};

export type OverlaySnapshot<Value> = {
  phase: OverlayHostPhase;
  active: ReadonlyArray<OverlayEntry<Value>>;
  queued: ReadonlyArray<OverlayEntry<Value>>;
  blockerIds: ReadonlyArray<string>;
};

type OverlayListener<Value> = (snapshot: OverlaySnapshot<Value>) => void;

export class OverlayCoordinator<Value> {
  private phase: OverlayHostPhase = 'idle';
  private active: Array<OverlayEntry<Value>> = [];
  private queued: Array<OverlayEntry<Value>> = [];
  private blockerCounts: Record<string, number> = {};
  private listeners: Array<OverlayListener<Value>> = [];

  getSnapshot(): OverlaySnapshot<Value> {
    return {
      phase: this.phase,
      active: this.active.slice(),
      queued: this.queued.slice(),
      blockerIds: Object.keys(this.blockerCounts).sort(),
    };
  }

  subscribe(listener: OverlayListener<Value>): () => void {
    this.listeners.push(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners = this.listeners.filter(
        candidate => candidate !== listener,
      );
    };
  }

  present(entry: OverlayEntry<Value>): void {
    const activeIndex = this.active.findIndex(
      candidate => candidate.id === entry.id,
    );
    if (activeIndex >= 0) {
      this.active[activeIndex] = entry;
      this.emit();
      return;
    }

    const queuedIndex = this.queued.findIndex(
      candidate => candidate.id === entry.id,
    );
    if (queuedIndex >= 0) {
      this.queued[queuedIndex] = entry;
      this.promoteQueuedEntries();
      this.emit();
      return;
    }

    if (this.shouldQueue(entry)) {
      this.queued.push(entry);
    } else {
      this.active.push(entry);
      if (this.phase === 'idle') {
        this.phase = 'presenting';
      }
    }

    this.emit();
  }

  dismiss(id: string): void {
    const queuedLength = this.queued.length;
    this.queued = this.queued.filter(entry => entry.id !== id);

    const activeLength = this.active.length;
    this.active = this.active.filter(entry => entry.id !== id);

    if (
      queuedLength === this.queued.length &&
      activeLength === this.active.length
    ) {
      return;
    }

    this.promoteQueuedEntries();

    if (this.active.length === 0 && this.phase !== 'idle') {
      this.phase = 'dismissing';
    }

    this.emit();
  }

  setBlocker(id: string, blocked: boolean): void {
    const currentCount = this.blockerCounts[id] || 0;

    if (blocked) {
      this.blockerCounts = {
        ...this.blockerCounts,
        [id]: currentCount + 1,
      };
      this.emit();
      return;
    }

    if (currentCount === 0) {
      return;
    }

    const nextCounts = {...this.blockerCounts};
    if (currentCount === 1) {
      delete nextCounts[id];
    } else {
      nextCounts[id] = currentCount - 1;
    }
    this.blockerCounts = nextCounts;
    this.promoteQueuedEntries();
    this.emit();
  }

  hostDidShow(): void {
    if (this.phase !== 'presenting') {
      return;
    }

    this.phase = 'active';
    this.emit();
  }

  hostDidDismiss(): void {
    if (this.phase !== 'dismissing') {
      return;
    }

    this.phase = 'idle';
    this.promoteQueuedEntries();
    this.emit();
  }

  private shouldQueue(entry: OverlayEntry<Value>): boolean {
    if (
      this.phase === 'dismissing' ||
      Object.keys(this.blockerCounts).length > 0
    ) {
      return true;
    }

    return entry.strategy === 'queue' && this.active.length > 0;
  }

  private promoteQueuedEntries(): void {
    if (
      this.phase === 'dismissing' ||
      Object.keys(this.blockerCounts).length > 0
    ) {
      return;
    }

    while (this.queued.length > 0) {
      const nextEntry = this.queued[0];
      if (this.active.length > 0 && nextEntry.strategy === 'queue') {
        return;
      }

      this.queued.shift();
      this.active.push(nextEntry);
      if (this.phase === 'idle') {
        this.phase = 'presenting';
      }

      if (nextEntry.strategy === 'queue') {
        return;
      }
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export function getVisibleOverlayIds<Value>(
  active: ReadonlyArray<OverlayEntry<Value>>,
): ReadonlyArray<string> {
  let firstVisibleIndex = 0;

  active.forEach((entry, index) => {
    if (entry.strategy === 'replace') {
      firstVisibleIndex = index;
    }
  });

  return active.slice(firstVisibleIndex).map(entry => entry.id);
}
