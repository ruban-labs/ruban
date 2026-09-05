package com.rubanlabs.dataengine;

final class RubanDataEngineBindings {
  static {
    System.loadLibrary("ruban_data_engine");
  }

  private RubanDataEngineBindings() {}

  static native String createMockSyncResultJson(
      String address, long observedAt, String optionsJson);

  static native String createDeBankRequestPlanJson(String address, String optionsJson);

  static native String createDeBankSyncResultJson(
      String address,
      long observedAt,
      String optionsJson,
      String payloadsJson,
      String source);

  static native long retryDelayMs(
      int statusCode, int completedAttempts, long retryAfterMs, int maxAttempts);
}
