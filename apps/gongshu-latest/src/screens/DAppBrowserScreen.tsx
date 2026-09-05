import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  createBridgeEventScript,
  createBridgeResponseScript,
  createDappTestCommandScript,
  createProviderContentScript,
  DappBridgeHostSession,
  type DappBridgeRequest,
  type DappTestCommand,
  type DappTestResult,
  parseDappTestResultMessage,
} from '@ruban-labs/react-native-dapp-bridge';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { useRubanColors } from '../design/tokens';
import { rubanDappProviderInfo } from '../dapp/providerIdentity';
import { useRpcRequestReview } from '../dapp/RpcRequestReviewProvider';
import { RpcReviewError } from '../dapp/rpcReviewQueue';
import { createTransactionReview } from '../dapp/transactionReview';
import type { RootStackParamList } from '../navigation/types';
import { evmClient } from '../portfolio/usePortfolio';
import { useFocusedRubanSystemBars } from '../system/RubanSystemBars';
import { useWallet } from '../wallet/WalletContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DAppBrowser'>;
type RubanWebViewExtensionProps = object;
type DAppBrowserViewProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  initialUrl: string;
  title?: string;
  testCommand?: DappTestCommand;
};
type DappTestState =
  | { status: 'running' }
  | { status: 'passed'; result: DappTestResult }
  | { status: 'failed'; result: DappTestResult };

class ProviderRpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
    this.name = 'ProviderRpcError';
  }
}
const readMethods = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'web3_clientVersion',
]);

function originOf(url: string): string | null {
  const match = url.match(/^(https?):\/\/([^/]+)/i);
  return match ? `${match[1].toLowerCase()}://${match[2].toLowerCase()}` : null;
}

export function DAppBrowserView({
  navigation,
  initialUrl,
  title,
  testCommand,
}: DAppBrowserViewProps): React.ReactElement {
  const colors = useRubanColors();
  const wallet = useWallet();
  const requestReview = useRpcRequestReview();
  const webView = React.useRef<WebView<RubanWebViewExtensionProps>>(null);
  const sessionId = React.useRef(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  ).current;
  const bridgeSession = React.useMemo(
    () => new DappBridgeHostSession(sessionId),
    [sessionId],
  );
  const permissions = React.useRef(new Set<string>());
  const pendingMessages = React.useRef<string[]>([]);
  const [url, setUrl] = React.useState(initialUrl);
  const topLevelUrl = React.useRef(initialUrl);
  const [chainId, setChainId] = React.useState(wallet.selectedChainId);
  const [progress, setProgress] = React.useState(0);
  const [testState, setTestState] = React.useState<DappTestState | null>(
    testCommand ? { status: 'running' } : null,
  );
  const startedTestRun = React.useRef<string | null>(null);
  const providerScript = React.useMemo(
    () =>
      createProviderContentScript({
        sessionId,
        providerInfo: rubanDappProviderInfo,
        requestTimeoutMs: 120000,
      }),
    [sessionId],
  );

  useFocusedRubanSystemBars(colors.mode, colors.surface);

  React.useEffect(() => {
    setChainId(wallet.selectedChainId);
  }, [wallet.selectedChainId]);

  const reply = React.useCallback(
    (
      request: DappBridgeRequest,
      result?: unknown,
      error?: { code: number; message: string },
    ) => {
      webView.current?.injectJavaScript(
        createBridgeResponseScript(request, {
          id: request.id,
          result,
          error,
        }),
      );
    },
    [],
  );

  const browserRequest = React.useCallback(
    (origin: string, method: string, params: readonly unknown[] = []) =>
      evmClient.request({
        context: { source: 'browser', origin, sessionId },
        chainId,
        method,
        params,
      }),
    [chainId, sessionId],
  );

  const requestPermission = React.useCallback(
    async (origin: string, requestId: string): Promise<void> => {
      if (permissions.current.has(origin)) return Promise.resolve();
      if (!wallet.selectedAccount)
        throw new ProviderRpcError(4100, 'Create or select an account first');
      const chain = evmClient.getChain(chainId);
      await requestReview.review({
        id: requestId,
        sessionId,
        kind: 'connect',
        method: 'eth_requestAccounts',
        title: 'Connect account',
        origin,
        account: wallet.selectedAccount.address,
        chainName: chain?.name,
        badge: 'ACCOUNT ACCESS',
        rows: [
          { label: 'ACCOUNT', value: wallet.selectedAccount.address },
          { label: 'NETWORK', value: chain?.name || `Chain ${chainId}` },
        ],
        approveLabel: 'CONNECT',
      });
      permissions.current.add(origin);
    },
    [chainId, requestReview, sessionId, wallet.selectedAccount],
  );

  const sendTransaction = React.useCallback(
    async (
      transaction: Record<string, string>,
      origin: string,
    ): Promise<string> => {
      if (!wallet.selectedAccount) throw new Error('Select an account first');
      const from = transaction.from || wallet.selectedAccount.address;
      if (from.toLowerCase() !== wallet.selectedAccount.address.toLowerCase())
        throw new Error('Transaction account does not match');
      const [nonceValue, gasLimit, gasPrice, priorityFee] = await Promise.all([
        transaction.nonce
          ? Promise.resolve(transaction.nonce)
          : (browserRequest(origin, 'eth_getTransactionCount', [
              from,
              'pending',
            ]) as Promise<string>),
        transaction.gas
          ? Promise.resolve(transaction.gas)
          : (browserRequest(origin, 'eth_estimateGas', [
              transaction,
            ]) as Promise<string>),
        transaction.maxFeePerGas
          ? Promise.resolve(transaction.maxFeePerGas)
          : (browserRequest(origin, 'eth_gasPrice') as Promise<string>),
        transaction.maxPriorityFeePerGas
          ? Promise.resolve(transaction.maxPriorityFeePerGas)
          : (
              browserRequest(
                origin,
                'eth_maxPriorityFeePerGas',
              ) as Promise<string>
            ).catch(() => '0x59682f00'),
      ]);
      const signed = await wallet.signTransaction(
        {
          chainId,
          nonce: nonceValue,
          gasLimit,
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: priorityFee,
          to: transaction.to,
          value: transaction.value || '0x0',
          data: transaction.data || '0x',
        },
        { origin, chainId, title },
      );
      return browserRequest(origin, 'eth_sendRawTransaction', [
        signed.rawTransaction,
      ]) as Promise<string>;
    },
    [browserRequest, chainId, title, wallet],
  );

  const handleRequest = React.useCallback(
    async (request: DappBridgeRequest) => {
      const origin = originOf(topLevelUrl.current);
      if (!origin) throw new Error('Unsupported DApp origin');
      const params = Array.isArray(request.params) ? request.params : [];
      if (request.method === 'eth_chainId') return `0x${chainId.toString(16)}`;
      if (request.method === 'net_version') return String(chainId);
      if (request.method === 'eth_accounts')
        return permissions.current.has(origin) && wallet.selectedAccount
          ? [wallet.selectedAccount.address]
          : [];
      if (request.method === 'eth_requestAccounts') {
        await requestPermission(origin, reviewId(request));
        return wallet.selectedAccount ? [wallet.selectedAccount.address] : [];
      }
      if (request.method === 'wallet_switchEthereumChain') {
        const value = (params[0] as { chainId?: string } | undefined)?.chainId;
        const nextChainId =
          typeof value === 'string' ? parseInt(value, 16) : NaN;
        if (!Number.isFinite(nextChainId) || !evmClient.getChain(nextChainId))
          throw new ProviderRpcError(4902, 'Unsupported chain');
        const currentChain = evmClient.getChain(chainId);
        const nextChain = evmClient.getChain(nextChainId);
        await requestReview.review({
          id: reviewId(request),
          sessionId,
          kind: 'switch-chain',
          method: request.method,
          title: 'Switch network',
          origin,
          badge: 'NETWORK',
          rows: [
            { label: 'FROM', value: currentChain?.name || `Chain ${chainId}` },
            { label: 'TO', value: nextChain?.name || `Chain ${nextChainId}` },
          ],
          approveLabel: 'SWITCH',
        });
        setChainId(nextChainId);
        await wallet.selectChain(nextChainId);
        webView.current?.injectJavaScript(
          createBridgeEventScript(request, 'chainChanged', [
            `0x${nextChainId.toString(16)}`,
          ]),
        );
        return null;
      }
      if (readMethods.has(request.method))
        return browserRequest(origin, request.method, params);
      await requestPermission(origin, `${reviewId(request)}:connect`);
      if (!wallet.selectedAccount) throw new Error('Select an account first');
      if (request.method === 'personal_sign') {
        const selectedAddress = wallet.selectedAccount.address.toLowerCase();
        const message = params.find(
          value =>
            typeof value === 'string' &&
            value.toLowerCase() !== selectedAddress,
        );
        if (
          typeof message !== 'string' ||
          !/^0x(?:[0-9a-f]{2})*$/i.test(message)
        ) {
          throw new Error('personal_sign requires a hex-encoded message');
        }
        await requestReview.review({
          id: reviewId(request),
          sessionId,
          kind: 'personal-sign',
          method: request.method,
          title: 'Sign message',
          origin,
          account: wallet.selectedAccount.address,
          chainName: evmClient.getChain(chainId)?.name,
          badge: 'MESSAGE',
          rows: [
            { label: 'ACCOUNT', value: wallet.selectedAccount.address },
            {
              label: 'NETWORK',
              value: evmClient.getChain(chainId)?.name || `Chain ${chainId}`,
            },
          ],
          payload: previewHexMessage(message),
          approveLabel: 'SIGN',
        });
        return wallet.signPersonal(message, {
          origin,
          chainId,
          title,
        });
      }
      if (request.method === 'eth_signTypedData_v4') {
        const selectedAddress = wallet.selectedAccount.address.toLowerCase();
        const typedDataValue = params.find(
          value =>
            typeof value !== 'string' ||
            value.toLowerCase() !== selectedAddress,
        );
        const typedData =
          typeof typedDataValue === 'string'
            ? typedDataValue
            : JSON.stringify(typedDataValue);
        if (!typedData) throw new Error('Typed data is required');
        await requestReview.review({
          id: reviewId(request),
          sessionId,
          kind: 'typed-sign',
          method: request.method,
          title: 'Sign typed data',
          origin,
          account: wallet.selectedAccount.address,
          chainName: evmClient.getChain(chainId)?.name,
          badge: 'EIP-712',
          rows: [
            { label: 'ACCOUNT', value: wallet.selectedAccount.address },
            {
              label: 'NETWORK',
              value: evmClient.getChain(chainId)?.name || `Chain ${chainId}`,
            },
          ],
          payload: formatJsonPreview(typedData),
          approveLabel: 'SIGN',
        });
        return wallet.signTyped(typedData, {
          origin,
          chainId,
          title,
        });
      }
      if (request.method === 'eth_sendTransaction') {
        const transaction = (params[0] || {}) as Record<string, string>;
        const chain = evmClient.getChain(chainId);
        if (!chain) throw new ProviderRpcError(4902, 'Unsupported chain');
        if (
          transaction.from &&
          transaction.from.toLowerCase() !==
            wallet.selectedAccount.address.toLowerCase()
        ) {
          throw new ProviderRpcError(
            4100,
            'Transaction account does not match the selected account',
          );
        }
        const parsed = createTransactionReview(
          transaction,
          chain,
          wallet.selectedAccount.address,
        );
        await requestReview.review({
          id: reviewId(request),
          sessionId,
          kind: 'send-transaction',
          method: request.method,
          title: 'Review transaction',
          origin,
          account: wallet.selectedAccount.address,
          chainName: chain.name,
          badge: parsed.badge,
          rows: parsed.rows,
          payload: parsed.payload,
          approveLabel: 'CONTINUE',
        });
        return sendTransaction(transaction, origin);
      }
      throw new ProviderRpcError(
        4200,
        `Unsupported provider method: ${request.method}`,
      );
    },
    [
      browserRequest,
      chainId,
      requestPermission,
      requestReview,
      sessionId,
      title,
      sendTransaction,
      wallet,
    ],
  );

  const handleMessageData = React.useCallback(
    (messageData: string) => {
      if (testCommand) {
        try {
          const result = parseDappTestResultMessage(
            messageData,
            testCommand.runId,
          );
          if (result) {
            setTestState({ status: result.status, result });
            console.info(
              `RUBAN_DAPP_TEST ${result.status.toUpperCase()} runId=${
                result.runId
              } method=${result.method}`,
            );
            return;
          }
        } catch (error) {
          const result: DappTestResult = {
            channel: 'ruban-dapp-test-v1',
            runId: testCommand.runId,
            method: testCommand.method,
            status: 'failed',
            error: {
              message:
                error instanceof Error ? error.message : 'Invalid test result',
            },
          };
          setTestState({ status: 'failed', result });
          return;
        }
      }
      let request: DappBridgeRequest;
      try {
        request = bridgeSession.parse(messageData);
      } catch {
        return;
      }
      handleRequest(request).then(
        result => {
          reply(request, result);
          bridgeSession.complete(request);
        },
        error => {
          reply(request, undefined, providerError(error));
          bridgeSession.complete(request);
        },
      );
    },
    [bridgeSession, handleRequest, reply, testCommand],
  );

  const onMessage = React.useCallback(
    (event: WebViewMessageEvent) => {
      if (wallet.loading) {
        if (pendingMessages.current.length < 32) {
          pendingMessages.current.push(event.nativeEvent.data);
        }
        return;
      }
      handleMessageData(event.nativeEvent.data);
    },
    [handleMessageData, wallet.loading],
  );

  React.useEffect(() => {
    if (wallet.loading || pendingMessages.current.length === 0) return;
    const messages = pendingMessages.current.splice(0);
    messages.forEach(handleMessageData);
  }, [handleMessageData, wallet.loading]);

  const updateNavigation = React.useCallback((state: WebViewNavigation) => {
    topLevelUrl.current = state.url;
    setUrl(state.url);
  }, []);

  const beginNavigation = React.useCallback(
    (state: WebViewNavigation) => {
      pendingMessages.current.length = 0;
      requestReview.cancelSession(sessionId);
      bridgeSession.beginNavigation();
      updateNavigation(state);
    },
    [bridgeSession, requestReview, sessionId, updateNavigation],
  );

  React.useEffect(
    () => () => requestReview.cancelSession(sessionId),
    [requestReview, sessionId],
  );

  const executeTestCommand = React.useCallback(() => {
    if (!testCommand || startedTestRun.current === testCommand.runId) return;
    startedTestRun.current = testCommand.runId;
    setTestState({ status: 'running' });
    webView.current?.injectJavaScript(createDappTestCommandScript(testCommand));
  }, [testCommand]);

  const reload = React.useCallback(() => {
    if (testCommand) {
      startedTestRun.current = null;
      setTestState({ status: 'running' });
    }
    webView.current?.reload();
  }, [testCommand]);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.root, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.back}>
          <Text style={[styles.backText, { color: colors.ink }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.location}>
          <Text
            numberOfLines={1}
            style={[styles.domain, { color: colors.ink }]}
          >
            {(originOf(url) || url).replace(/^https?:\/\//, '')}
          </Text>
          <Text style={[styles.chain, { color: colors.faint }]}>
            CHAIN {chainId}
          </Text>
        </View>
        <TouchableOpacity onPress={reload} style={styles.back}>
          <Text style={[styles.reload, { color: colors.accent }]}>↻</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressValue,
            {
              backgroundColor: colors.accent,
              width: `${Math.round(progress * 100)}%`,
            },
          ]}
        />
      </View>
      {testCommand && testState ? (
        <View
          testID={
            testState.status === 'passed'
              ? 'dapp-test-pass'
              : testState.status === 'failed'
              ? 'dapp-test-fail'
              : 'dapp-test-running'
          }
          style={[
            styles.testStatus,
            {
              backgroundColor:
                testState.status === 'failed'
                  ? colors.alertSoft
                  : colors.surfaceRaised,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.testLabel, { color: colors.faint }]}>
            RPC TEST
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.testValue,
              {
                color:
                  testState.status === 'failed' ? colors.alert : colors.ink,
              },
            ]}
          >
            {testCommand.method} · {testState.status.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <WebView<RubanWebViewExtensionProps>
        ref={webView}
        source={{ uri: initialUrl }}
        injectedJavaScriptBeforeContentLoaded={providerScript}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        onMessage={onMessage}
        onLoadProgress={event => setProgress(event.nativeEvent.progress)}
        onLoadStart={event => beginNavigation(event.nativeEvent)}
        onLoadEnd={executeTestCommand}
        onNavigationStateChange={updateNavigation}
        onShouldStartLoadWithRequest={request =>
          /^https?:\/\//i.test(request.url)
        }
        originWhitelist={['https://*', 'http://*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
      />
    </SafeAreaView>
  );
}

function reviewId(request: DappBridgeRequest): string {
  return `${request.sessionId}:${request.documentId}:${request.id}`;
}

function providerError(error: unknown): { code: number; message: string } {
  if (error instanceof ProviderRpcError || error instanceof RpcReviewError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 4200,
    message: error instanceof Error ? error.message : 'Provider request failed',
  };
}

function previewHexMessage(message: string): string {
  try {
    const bytes = message
      .slice(2)
      .match(/.{2}/g)
      ?.map(value => parseInt(value, 16));
    if (!bytes) return message;
    const decoded = String.fromCharCode(...bytes);
    return /^[\x20-\x7e\r\n\t]*$/.test(decoded) ? decoded : message;
  } catch {
    return message;
  }
}

function formatJsonPreview(value: string): string {
  try {
    const formatted = JSON.stringify(JSON.parse(value), null, 2);
    return formatted.length <= 2400
      ? formatted
      : `${formatted.slice(0, 2400)}…`;
  } catch {
    return value.length <= 2400 ? value : `${value.slice(0, 2400)}…`;
  }
}

export default function DAppBrowserScreen({
  route,
  navigation,
}: Props): React.ReactElement {
  return (
    <DAppBrowserView
      navigation={navigation}
      initialUrl={route.params.url}
      title={route.params.title}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 24, lineHeight: 28 },
  reload: { fontSize: 21, lineHeight: 26, fontWeight: '700' },
  location: { flex: 1, alignItems: 'center' },
  domain: { maxWidth: '100%', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  chain: {
    marginTop: 2,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  progressTrack: { height: 2 },
  progressValue: { height: 2 },
  testStatus: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  testLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  testValue: {
    marginLeft: 12,
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
});
