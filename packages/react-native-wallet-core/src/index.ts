import { NativeModules, Platform } from "react-native";

export type WalletAccountKind = "mnemonic" | "private-key" | "watch-only";

export type WalletAccount = {
  id: string;
  label: string;
  address: string;
  kind: WalletAccountKind;
  derivationPath?: string;
  createdAt: number;
};

export type SignRequestContext = {
  origin: string;
  chainId: number;
  title?: string;
  accountAddress?: string;
};

export type Eip1559Transaction = {
  chainId: number;
  nonce: string;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  to?: string;
  value: string;
  data?: string;
};

export type SignedEip1559Transaction = {
  rawTransaction: string;
  transactionHash: string;
};

type NativeWalletCoreModule = {
  presentCreateMnemonic(label: string): Promise<WalletAccount>;
  presentImportMnemonic(label: string): Promise<WalletAccount>;
  presentImportPrivateKey(label: string): Promise<WalletAccount>;
  addWatchOnly(label: string, address: string): Promise<WalletAccount>;
  deleteSecret(accountId: string): Promise<void>;
  signPersonalMessage(
    accountId: string,
    messageHex: string,
    context: SignRequestContext
  ): Promise<string>;
  signTypedData(
    accountId: string,
    typedDataJson: string,
    context: SignRequestContext
  ): Promise<string>;
  signEip1559Transaction(
    accountId: string,
    transaction: Eip1559Transaction,
    context: SignRequestContext
  ): Promise<SignedEip1559Transaction>;
};

const LINKING_ERROR =
  `The package '@ruban-labs/react-native-wallet-core' is not linked. ` +
  `Rebuild the ${Platform.OS} application after installing the package.`;

const nativeModule = NativeModules.RubanWalletCore as
  | NativeWalletCoreModule
  | undefined;

function requireNativeModule(): NativeWalletCoreModule {
  if (!nativeModule) {
    throw new Error(LINKING_ERROR);
  }
  return nativeModule;
}

export function isWalletCoreAvailable(): boolean {
  return nativeModule != null;
}

export function presentCreateMnemonic(
  label = "Account"
): Promise<WalletAccount> {
  return requireNativeModule().presentCreateMnemonic(label);
}

export function presentImportMnemonic(
  label = "Imported account"
): Promise<WalletAccount> {
  return requireNativeModule().presentImportMnemonic(label);
}

export function presentImportPrivateKey(
  label = "Imported key"
): Promise<WalletAccount> {
  return requireNativeModule().presentImportPrivateKey(label);
}

export function addWatchOnly(
  label: string,
  address: string
): Promise<WalletAccount> {
  return requireNativeModule().addWatchOnly(label, address);
}

export function deleteSecret(accountId: string): Promise<void> {
  return requireNativeModule().deleteSecret(accountId);
}

export function signPersonalMessage(
  accountId: string,
  messageHex: string,
  context: SignRequestContext
): Promise<string> {
  return requireNativeModule().signPersonalMessage(
    accountId,
    messageHex,
    context
  );
}

export function signTypedData(
  accountId: string,
  typedDataJson: string,
  context: SignRequestContext
): Promise<string> {
  return requireNativeModule().signTypedData(accountId, typedDataJson, context);
}

export function signEip1559Transaction(
  accountId: string,
  transaction: Eip1559Transaction,
  context: SignRequestContext
): Promise<SignedEip1559Transaction> {
  return requireNativeModule().signEip1559Transaction(
    accountId,
    transaction,
    context
  );
}
