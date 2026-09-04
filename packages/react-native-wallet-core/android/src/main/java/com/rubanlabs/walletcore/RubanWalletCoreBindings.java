package com.rubanlabs.walletcore;

final class RubanWalletCoreBindings {
  static {
    System.loadLibrary("ruban_wallet_core");
  }

  private RubanWalletCoreBindings() {}

  static native String invoke(String requestJson);
}
