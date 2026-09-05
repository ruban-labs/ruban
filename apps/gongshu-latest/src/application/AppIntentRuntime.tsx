import * as React from 'react';
import { Linking } from 'react-native';
import { appEnvironment } from '../runtime/appEnvironment';
import { repositories } from '../storage/repositories';
import {
  AppIntentFailure,
  createAppIntentEnvelope,
  parseDeveloperAppIntent,
  type AppIntent,
  type AppIntentReceipt,
} from './appIntent';
import { AppIntentDispatcher } from './appIntentDispatcher';
import { appIntentUseCases } from './appIntentUseCases';

type ReceiptListener = (receipt: AppIntentReceipt) => void;
const receiptListeners = new Set<ReceiptListener>();

function publishReceipt(receipt: AppIntentReceipt): void {
  console.info(`RUBAN_APP_INTENT_RECEIPT ${JSON.stringify(receipt)}`);
  receiptListeners.forEach(listener => listener(receipt));
}

export const appIntentDispatcher = new AppIntentDispatcher({
  receipts: {
    get: runId => repositories.getAppIntentReceipt(runId),
    save: receipt => repositories.saveAppIntentReceipt(receipt),
  },
  useCases: appIntentUseCases,
  onReceipt: publishReceipt,
});

export function subscribeAppIntentReceipts(listener: ReceiptListener): () => void {
  receiptListeners.add(listener);
  return () => receiptListeners.delete(listener);
}

export async function runUiAppIntent(intent: AppIntent): Promise<AppIntentReceipt> {
  const receipt = await appIntentDispatcher.dispatch(
    createAppIntentEnvelope(intent, 'ui'),
  );
  if (receipt.status === 'failed') {
    throw new AppIntentFailure(receipt.errorCode || 'intent_failed');
  }
  return receipt;
}

async function handleDeveloperUrl(url: string | null | undefined): Promise<void> {
  const envelope = parseDeveloperAppIntent(url, appEnvironment);
  if (!envelope) return;
  try {
    await appIntentDispatcher.dispatch(envelope);
  } catch (error) {
    const errorCode =
      error instanceof AppIntentFailure ? error.code : 'intent_dispatch_failed';
    console.info(
      `RUBAN_APP_INTENT_REJECTED ${JSON.stringify({
        runId: envelope.runId,
        action: envelope.intent.action,
        errorCode,
      })}`,
    );
  }
}

export function AppIntentRuntime(): null {
  React.useEffect(() => {
    let active = true;
    Linking.getInitialURL().then(url => {
      if (active) handleDeveloperUrl(url);
    });
    const subscription = Linking.addEventListener('url', event => {
      if (active) handleDeveloperUrl(event.url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return null;
}
