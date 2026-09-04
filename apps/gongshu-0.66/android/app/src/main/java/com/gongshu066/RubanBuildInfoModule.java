package com.gongshu066;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import java.util.Collections;
import java.util.Map;

public class RubanBuildInfoModule extends ReactContextBaseJavaModule {
  RubanBuildInfoModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "RubanBuildInfo";
  }

  @Override
  public Map<String, Object> getConstants() {
    return Collections.<String, Object>singletonMap(
        "environment", BuildConfig.RUBAN_APP_CHANNEL);
  }
}
