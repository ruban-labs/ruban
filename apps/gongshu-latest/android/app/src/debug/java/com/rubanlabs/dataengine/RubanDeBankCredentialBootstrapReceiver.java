package com.rubanlabs.dataengine;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public final class RubanDeBankCredentialBootstrapReceiver extends BroadcastReceiver {
  private static final String ACTION_SUFFIX = ".action.IMPORT_DEBANK_ACCESS_KEY";
  private static final String FILE_NAME = "ruban-debank-access-key";
  private static final int MAX_BYTES = 4096;

  @Override
  public void onReceive(Context context, Intent intent) {
    setResultCode(Activity.RESULT_CANCELED);
    File source = new File(context.getFilesDir(), FILE_NAME);
    try {
      boolean debuggable =
          (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
      String expectedAction = context.getPackageName() + ACTION_SUFFIX;
      if (!debuggable || intent == null || !expectedAction.equals(intent.getAction())) {
        return;
      }

      byte[] bytes = readBytes(source);
      try {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
          return;
        }
        String accessKey = decode(bytes);
        if (accessKey.endsWith("\r\n")) {
          accessKey = accessKey.substring(0, accessKey.length() - 2);
        } else if (accessKey.endsWith("\n")) {
          accessKey = accessKey.substring(0, accessKey.length() - 1);
        }
        if (accessKey.isEmpty() || accessKey.indexOf('\r') >= 0 || accessKey.indexOf('\n') >= 0) {
          return;
        }
        new RubanDeBankCredentialStore(context).write(accessKey);
        setResultCode(Activity.RESULT_OK);
      } finally {
        Arrays.fill(bytes, (byte) 0);
      }
    } catch (Exception ignored) {
      setResultCode(Activity.RESULT_CANCELED);
    } finally {
      if (source.exists()) {
        source.delete();
      }
    }
  }

  private static String decode(byte[] bytes) throws CharacterCodingException {
    return StandardCharsets.UTF_8
        .newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(bytes))
        .toString();
  }

  private static byte[] readBytes(File source) throws IOException {
    long length = source.length();
    if (length < 1 || length > MAX_BYTES) {
      throw new IOException("invalid_source_size");
    }
    byte[] bytes = new byte[(int) length];
    try (FileInputStream input = new FileInputStream(source)) {
      int offset = 0;
      while (offset < bytes.length) {
        int count = input.read(bytes, offset, bytes.length - offset);
        if (count < 0) throw new IOException("unexpected_end_of_source");
        offset += count;
      }
      if (input.read() >= 0) throw new IOException("source_grew_during_read");
    }
    return bytes;
  }
}
