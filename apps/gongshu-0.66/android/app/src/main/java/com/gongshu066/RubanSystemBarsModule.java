package com.gongshu066;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import androidx.annotation.NonNull;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RubanSystemBarsModule extends ReactContextBaseJavaModule {
  private static final int LEGACY_BAR_SCRIM_ALPHA = 35;

  RubanSystemBarsModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "RubanSystemBars";
  }

  @ReactMethod
  public void setStyle(boolean darkContent, int backgroundColor) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      return;
    }

    activity.runOnUiThread(
        () -> applyStyle(activity.getWindow(), darkContent, backgroundColor));
  }

  public static void enableEdgeToEdge(Window window) {
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setNavigationBarColor(Color.TRANSPARENT);
      window.setNavigationBarDividerColor(Color.TRANSPARENT);
      window.setNavigationBarContrastEnforced(true);
    }
  }

  private static void applyStyle(Window window, boolean darkContent, int backgroundColor) {
    enableEdgeToEdge(window);

    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(window, window.getDecorView());
    controller.setAppearanceLightStatusBars(darkContent);
    controller.setAppearanceLightNavigationBars(darkContent);

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      window.setStatusBarColor(readableLegacyColor(backgroundColor, darkContent));
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      window.setNavigationBarColor(
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
              ? backgroundColor
              : readableLegacyColor(backgroundColor, darkContent));
    }
  }

  private static int readableLegacyColor(int backgroundColor, boolean darkContent) {
    return darkContent
        ? ColorUtils.blendARGB(
            backgroundColor, Color.BLACK, LEGACY_BAR_SCRIM_ALPHA / 100f)
        : backgroundColor;
  }
}
