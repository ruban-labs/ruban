package com.rubanlabs.dataengine;

import android.content.pm.ApplicationInfo;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public final class RubanDataEngineModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "RubanDataEngine";
  private static final String SYNC_EVENT = "RubanDataEngineSyncState";
  private final ReactApplicationContext context;
  private final ExecutorService writer = Executors.newSingleThreadExecutor();
  private volatile String databasePath;

  RubanDataEngineModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void initialize(String path, Promise promise) {
    if (path == null || path.isEmpty() || !new File(path).isFile()) {
      promise.reject("invalid_database_path", "Ruban database is not initialized");
      return;
    }
    databasePath = path;
    promise.resolve(null);
  }

  @ReactMethod
  public void configureMockSource(String providerId, Promise promise) {
    writer.execute(() -> {
      try {
        requireProvider(providerId);
        long updatedAt = System.currentTimeMillis();
        withDatabase(database -> database.execSQL(
            "INSERT OR REPLACE INTO portfolio_data_sources " +
                "(provider_id, mode, credential_state, enabled, updated_at) VALUES (?, ?, ?, ?, ?)",
            new Object[] {providerId, "mock", "mock", 1, updatedAt}));
        WritableMap result = Arguments.createMap();
        result.putString("providerId", providerId);
        result.putString("mode", "mock");
        result.putString("credentialState", "mock");
        result.putBoolean("enabled", true);
        result.putDouble("updatedAt", updatedAt);
        promise.resolve(result);
      } catch (Exception error) {
        reject(promise, error);
      }
    });
  }

  @ReactMethod
  public void syncMockPortfolio(String providerId, String address, Promise promise) {
    String runId = UUID.randomUUID().toString();
    long queuedAt = System.currentTimeMillis();
    emitSyncState(providerId, address, runId, "queued", "waiting", 0, 5, queuedAt, null);
    writer.execute(() -> runSync(providerId, address, runId, promise));
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(double count) {}

  private void runSync(String providerId, String address, String runId, Promise promise) {
    long startedAt = System.currentTimeMillis();
    try {
      requireProvider(providerId);
      writeSyncState(providerId, address, runId, "running", "portfolio", 0, 5,
          startedAt, 0, startedAt, null);
      emitSyncState(providerId, address, runId, "running", "portfolio", 0, 5,
          startedAt, null);
      String json = RubanDataEngineBindings.createMockProjectionJson(address, startedAt);
      JSONObject projection = new JSONObject(json);
      String normalizedAddress = projection.getString("address");
      JSONArray chains = projection.getJSONArray("chains");
      JSONArray tokens = projection.getJSONArray("tokens");
      JSONArray protocols = projection.getJSONArray("protocols");
      long completedAt = System.currentTimeMillis();

      withDatabase(database -> {
        database.beginTransactionNonExclusive();
        try {
          replaceProjection(database, projection, chains, tokens, protocols);
          upsertSyncState(database, providerId, normalizedAddress, runId, "succeeded",
              "complete", chains.length(), chains.length(), startedAt, completedAt,
              completedAt - startedAt, completedAt, null);
          database.setTransactionSuccessful();
        } finally {
          database.endTransaction();
        }
      });

      emitSyncState(providerId, normalizedAddress, runId, "succeeded", "complete",
          chains.length(), chains.length(), completedAt, null);
      WritableMap result = Arguments.createMap();
      result.putString("providerId", providerId);
      result.putString("address", normalizedAddress);
      result.putString("runId", runId);
      result.putInt("completedChains", chains.length());
      result.putInt("totalChains", chains.length());
      result.putDouble("observedAt", projection.getLong("observedAt"));
      promise.resolve(result);
    } catch (Exception error) {
      long failedAt = System.currentTimeMillis();
      try {
        writeSyncState(providerId, address, runId, "failed", "complete", 0, 5,
            startedAt, failedAt, failedAt, "sync_failed");
      } catch (Exception ignored) {
      }
      emitSyncState(providerId, address, runId, "failed", "complete", 0, 5,
          failedAt, "sync_failed");
      reject(promise, error);
    }
  }

  private void replaceProjection(SQLiteDatabase database, JSONObject projection,
      JSONArray chains, JSONArray tokens, JSONArray protocols) throws Exception {
    String providerId = projection.getString("providerId");
    String address = projection.getString("address");
    long observedAt = projection.getLong("observedAt");
    Object[] key = new Object[] {providerId, address};
    database.execSQL("DELETE FROM portfolio_token_balances WHERE provider_id = ? AND address = ?", key);
    database.execSQL("DELETE FROM portfolio_protocol_positions WHERE provider_id = ? AND address = ?", key);
    database.execSQL("DELETE FROM portfolio_chain_snapshots WHERE provider_id = ? AND address = ?", key);
    database.execSQL("DELETE FROM portfolio_account_snapshots WHERE provider_id = ? AND address = ?", key);
    database.execSQL(
        "INSERT INTO portfolio_account_snapshots " +
            "(provider_id, address, total_value_usd, observed_at) VALUES (?, ?, ?, ?)",
        new Object[] {providerId, address, projection.getDouble("totalValueUsd"), observedAt});

    for (int index = 0; index < chains.length(); index += 1) {
      JSONObject chain = chains.getJSONObject(index);
      database.execSQL(
          "INSERT INTO portfolio_chain_snapshots " +
              "(provider_id, address, chain_id, chain_key, chain_name, value_usd, latency_ms, source, observed_at) " +
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          new Object[] {providerId, address, chain.getLong("chainId"),
              chain.getString("chainKey"), chain.getString("chainName"),
              chain.getDouble("valueUsd"), chain.getLong("latencyMs"),
              chain.getString("source"), observedAt});
    }
    for (int index = 0; index < tokens.length(); index += 1) {
      JSONObject token = tokens.getJSONObject(index);
      database.execSQL(
          "INSERT INTO portfolio_token_balances " +
              "(provider_id, address, chain_id, asset_id, symbol, name, contract_address, decimals, balance, display_balance, price_usd, value_usd, observed_at) " +
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          new Object[] {providerId, address, token.getLong("chainId"),
              token.getString("assetId"), token.getString("symbol"),
              token.getString("name"), nullableString(token, "contractAddress"),
              token.getInt("decimals"), token.getString("balance"),
              token.getString("displayBalance"), token.getDouble("priceUsd"),
              token.getDouble("valueUsd"), observedAt});
    }
    for (int index = 0; index < protocols.length(); index += 1) {
      JSONObject protocol = protocols.getJSONObject(index);
      database.execSQL(
          "INSERT INTO portfolio_protocol_positions " +
              "(provider_id, address, chain_id, protocol_id, position_id, protocol_name, category, asset_value_usd, debt_value_usd, net_value_usd, observed_at) " +
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          new Object[] {providerId, address, protocol.getLong("chainId"),
              protocol.getString("protocolId"), protocol.getString("positionId"),
              protocol.getString("protocolName"), protocol.getString("category"),
              protocol.getDouble("assetValueUsd"), protocol.getDouble("debtValueUsd"),
              protocol.getDouble("netValueUsd"), observedAt});
    }
  }

  private String nullableString(JSONObject value, String key) {
    String result = value.optString(key, "");
    return result.isEmpty() ? null : result;
  }

  private void writeSyncState(String providerId, String address, String runId,
      String state, String stage, int completedChains, int totalChains,
      long startedAt, long completedAt, long updatedAt, String errorCode) throws Exception {
    withDatabase(database -> upsertSyncState(database, providerId, address.toLowerCase(), runId,
        state, stage, completedChains, totalChains, startedAt, completedAt,
        Math.max(0, completedAt - startedAt), updatedAt, errorCode));
  }

  private void upsertSyncState(SQLiteDatabase database, String providerId, String address,
      String runId, String state, String stage, int completedChains, int totalChains,
      long startedAt, long completedAt, long durationMs, long updatedAt, String errorCode) {
    database.execSQL(
        "INSERT OR REPLACE INTO portfolio_sync_state " +
            "(provider_id, address, run_id, state, stage, completed_chains, total_chains, started_at, completed_at, duration_ms, updated_at, error_code) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        new Object[] {providerId, address, runId, state, stage, completedChains,
            totalChains, startedAt, completedAt == 0 ? null : completedAt, durationMs,
            updatedAt, errorCode});
  }

  private void emitSyncState(String providerId, String address, String runId,
      String state, String stage, int completedChains, int totalChains,
      long updatedAt, String errorCode) {
    WritableMap payload = Arguments.createMap();
    payload.putString("providerId", providerId);
    payload.putString("address", address.toLowerCase());
    payload.putString("runId", runId);
    payload.putString("state", state);
    payload.putString("stage", stage);
    payload.putInt("completedChains", completedChains);
    payload.putInt("totalChains", totalChains);
    payload.putDouble("updatedAt", updatedAt);
    if (errorCode != null) payload.putString("errorCode", errorCode);
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(SYNC_EVENT, payload);
  }

  private void withDatabase(DatabaseOperation operation) throws Exception {
    String path = databasePath;
    if (path == null) throw new IllegalStateException("data_engine_not_initialized");
    SQLiteDatabase database = SQLiteDatabase.openDatabase(
        path, null, SQLiteDatabase.OPEN_READWRITE | SQLiteDatabase.NO_LOCALIZED_COLLATORS);
    try {
      try (Cursor cursor = database.rawQuery("PRAGMA busy_timeout = 5000", null)) {
        cursor.moveToFirst();
      }
      operation.run(database);
    } finally {
      database.close();
    }
  }

  private void requireProvider(String providerId) {
    if (!"debank".equals(providerId)) {
      throw new IllegalArgumentException("unsupported_provider");
    }
  }

  private void reject(Promise promise, Exception error) {
    if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      Log.e(MODULE_NAME, "Native data operation failed", error);
    }
    String code = error instanceof IllegalArgumentException
        ? error.getMessage()
        : "data_engine_failed";
    promise.reject(code, "Portfolio data engine failed", error);
  }

  private interface DatabaseOperation {
    void run(SQLiteDatabase database) throws Exception;
  }
}
