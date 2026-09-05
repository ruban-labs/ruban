package com.rubanlabs.dataengine;

import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

final class RubanDeBankHttpClient {
  private static final String BASE_URL = "https://pro-openapi.debank.com";
  private static final String HOST = "pro-openapi.debank.com";
  private static final long MINIMUM_INTERVAL_MS = 10;
  private static final long MAX_SYNC_DURATION_MS = 30000;
  private static final int REQUEST_COUNT = 3;
  private final RubanDeBankCredentialStore credentialStore;
  private long lastRequestAt;

  RubanDeBankHttpClient(RubanDeBankCredentialStore credentialStore) {
    this.credentialStore = credentialStore;
  }

  JSONArray execute(JSONArray plan) throws Exception {
    if (plan.length() != REQUEST_COUNT) {
      throw new IllegalArgumentException("provider_contract_invalid");
    }
    long deadline = SystemClock.elapsedRealtime() + MAX_SYNC_DURATION_MS;
    JSONArray payloads = new JSONArray();
    for (int index = 0; index < plan.length(); index += 1) {
      payloads.put(executeRequest(plan.getJSONObject(index), deadline));
    }
    return payloads;
  }

  private JSONObject executeRequest(JSONObject request, long deadline) throws Exception {
    String endpointId = request.getString("endpointId");
    String path = request.getString("path");
    int timeoutMs = request.getInt("timeoutMs");
    int maxBodyBytes = request.getInt("maxBodyBytes");
    int maxAttempts = request.getInt("maxAttempts");
    validatePath(endpointId, path);

    int completedAttempts = 0;
    while (completedAttempts < maxAttempts) {
      long remaining = deadline - SystemClock.elapsedRealtime();
      if (remaining <= 0) throw new IOException("provider_budget_exceeded");
      completedAttempts += 1;
      HttpResult result;
      try {
        result = executeOnce(path, (int) Math.min(timeoutMs, remaining), maxBodyBytes);
      } catch (IOException error) {
        long delay = RubanDataEngineBindings.retryDelayMs(
            0, completedAttempts, -1, maxAttempts);
        if (delay < 0) throw new IOException("provider_transport_failed", error);
        sleepWithinBudget(delay, deadline);
        continue;
      }
      if (result.statusCode >= 200 && result.statusCode < 300) {
        return payload(endpointId, result, completedAttempts);
      }
      long delay = RubanDataEngineBindings.retryDelayMs(
          result.statusCode, completedAttempts, result.retryAfterMs, maxAttempts);
      if (delay < 0) return payload(endpointId, result, completedAttempts);
      sleepWithinBudget(delay, deadline);
    }
    throw new IOException("provider_transport_failed");
  }

  private synchronized void applyRateLimit() throws InterruptedException {
    long now = SystemClock.elapsedRealtime();
    long wait = MINIMUM_INTERVAL_MS - (now - lastRequestAt);
    if (wait > 0) Thread.sleep(wait);
    lastRequestAt = SystemClock.elapsedRealtime();
  }

  private HttpResult executeOnce(String path, int timeoutMs, int maxBodyBytes)
      throws Exception {
    applyRateLimit();
    URL url = new URL(BASE_URL + path);
    if (!"https".equals(url.getProtocol()) || !HOST.equals(url.getHost())) {
      throw new IllegalArgumentException("provider_endpoint_rejected");
    }
    HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
    long startedAt = SystemClock.elapsedRealtime();
    try {
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(timeoutMs);
      connection.setReadTimeout(timeoutMs);
      connection.setInstanceFollowRedirects(false);
      connection.setUseCaches(false);
      connection.setRequestProperty("Accept", "application/json");
      connection.setRequestProperty("AccessKey", credentialStore.read());
      int statusCode = connection.getResponseCode();
      InputStream stream = statusCode >= 200 && statusCode < 400
          ? connection.getInputStream()
          : connection.getErrorStream();
      String body = stream == null ? "" : readBounded(stream, maxBodyBytes);
      return new HttpResult(statusCode, body,
          Math.max(0, SystemClock.elapsedRealtime() - startedAt),
          parseRetryAfter(connection.getHeaderField("Retry-After")));
    } finally {
      connection.disconnect();
    }
  }

  private void sleepWithinBudget(long delay, long deadline) throws Exception {
    if (delay < 0 || SystemClock.elapsedRealtime() + delay > deadline) {
      throw new IOException("provider_budget_exceeded");
    }
    Thread.sleep(delay);
  }

  private String readBounded(InputStream stream, int maxBodyBytes) throws IOException {
    try (InputStream input = stream;
         ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int total = 0;
      int read;
      while ((read = input.read(buffer)) != -1) {
        total += read;
        if (total > maxBodyBytes) throw new IOException("provider_response_too_large");
        output.write(buffer, 0, read);
      }
      return output.toString(StandardCharsets.UTF_8.name());
    }
  }

  private long parseRetryAfter(String value) {
    if (value == null) return -1;
    try {
      long seconds = Long.parseLong(value);
      if (seconds < 0) return -1;
      return Math.min(seconds * 1000, 5000);
    } catch (NumberFormatException error) {
      return -1;
    }
  }

  private JSONObject payload(String endpointId, HttpResult result, int attempts)
      throws Exception {
    JSONObject payload = new JSONObject();
    payload.put("endpointId", endpointId);
    payload.put("statusCode", result.statusCode);
    payload.put("body", result.body);
    payload.put("latencyMs", result.latencyMs);
    payload.put("attempts", attempts);
    return payload;
  }

  private void validatePath(String endpointId, String path) {
    boolean valid = ("total_balance".equals(endpointId) &&
        path.startsWith("/v1/user/total_balance?")) ||
        ("all_token_list".equals(endpointId) &&
            path.startsWith("/v1/user/all_token_list?")) ||
        ("all_simple_protocol_list".equals(endpointId) &&
            path.startsWith("/v1/user/all_simple_protocol_list?"));
    if (!valid || path.contains("://") || path.contains("#")) {
      throw new IllegalArgumentException("provider_endpoint_rejected");
    }
  }

  private static final class HttpResult {
    final int statusCode;
    final String body;
    final long latencyMs;
    final long retryAfterMs;

    HttpResult(int statusCode, String body, long latencyMs, long retryAfterMs) {
      this.statusCode = statusCode;
      this.body = body;
      this.latencyMs = latencyMs;
      this.retryAfterMs = retryAfterMs;
    }
  }
}
