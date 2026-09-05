import {
  AppIntentFailure,
  type AppIntent,
  type AppIntentEnvelope,
  type AppIntentReceipt,
  type AppIntentResult,
} from './appIntent';

export type AppIntentReceiptStore = {
  get(runId: string): Promise<AppIntentReceipt | null>;
  save(receipt: AppIntentReceipt): Promise<void>;
};

export type AppIntentUseCases = {
  execute(intent: AppIntent): Promise<AppIntentResult>;
};

type AppIntentDispatcherOptions = {
  receipts: AppIntentReceiptStore;
  useCases: AppIntentUseCases;
  onReceipt?: (receipt: AppIntentReceipt) => void;
  now?: () => number;
};

export class AppIntentDispatcher {
  private readonly inFlight = new Map<string, Promise<AppIntentReceipt>>();
  private readonly now: () => number;

  constructor(private readonly options: AppIntentDispatcherOptions) {
    this.now = options.now || Date.now;
  }

  dispatch(envelope: AppIntentEnvelope): Promise<AppIntentReceipt> {
    const active = this.inFlight.get(envelope.runId);
    if (active) return active;

    const execution = this.execute(envelope).finally(() => {
      this.inFlight.delete(envelope.runId);
    });
    this.inFlight.set(envelope.runId, execution);
    return execution;
  }

  private async execute(
    envelope: AppIntentEnvelope,
  ): Promise<AppIntentReceipt> {
    const existing = await this.options.receipts.get(envelope.runId);
    if (existing) {
      if (existing.action !== envelope.intent.action) {
        throw new AppIntentFailure('run_id_conflict');
      }
      this.options.onReceipt?.(existing);
      return existing;
    }

    let receipt: AppIntentReceipt;
    try {
      const result = await this.options.useCases.execute(envelope.intent);
      receipt = {
        runId: envelope.runId,
        action: envelope.intent.action,
        source: envelope.source,
        status: 'succeeded',
        result,
        completedAt: this.now(),
      };
    } catch (error) {
      receipt = {
        runId: envelope.runId,
        action: envelope.intent.action,
        source: envelope.source,
        status: 'failed',
        errorCode:
          error instanceof AppIntentFailure ? error.code : 'intent_failed',
        completedAt: this.now(),
      };
    }

    await this.options.receipts.save(receipt);
    this.options.onReceipt?.(receipt);
    return receipt;
  }
}
