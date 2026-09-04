package com.rubanlabs.dataengine;

final class RubanDataEngineBindings {
  static {
    System.loadLibrary("ruban_data_engine");
  }

  private RubanDataEngineBindings() {}

  static native String createMockProjectionJson(String address, long observedAt);
}
