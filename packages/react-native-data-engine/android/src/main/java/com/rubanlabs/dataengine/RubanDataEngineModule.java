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
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.io.File;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public final class RubanDataEngineModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "RubanDataEngine";
  private static final String SYNC_EVENT = "RubanDataEngineSyncState";
  private static final String PROVIDER_ID = "debank";
  private static final Set<String> SAFE_ERROR_CODES = Collections.unmodifiableSet(
      new HashSet<>(Arrays.asList(
          "credential_clear_failed",
          "credential_missing",
          "credential_store_failed",
          "credential_unavailable",
          "data_engine_not_initialized",
          "data_source_disabled",
          "data_source_not_configured",
          "database_open_failed",
          "database_write_failed",
          "invalid_access_key",
          "invalid_database_path",
          "invalid_evm_address",
          "invalid_incremental_chains",
          "invalid_sync_options",
          "provider_budget_exceeded",
          "provider_contract_invalid",
          "provider_endpoint_rejected",
          "provider_http_failed",
          "provider_response_too_large",
          "provider_transport_failed",
          "secure_storage_unavailable",
          "sync_already_running",
          "unsupported_provider")));

  private final ReactApplicationContext context;
  private final ExecutorService writer = Executors.newSingleThreadExecutor();
  private final RubanDeBankCredentialStore credentialStore;
  private final RubanDeBankHttpClient httpClient;
  private final Set<String> inFlightSyncs = Collections.synchronizedSet(new HashSet<>());
  private volatile String databasePath;

  RubanDataEngineModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
    credentialStore = new RubanDeBankCredentialStore(context);
    httpClient = new RubanDeBankHttpClient(credentialStore);
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
    writer.execute(() -> {
      try {
        databasePath = path;
        recoverInterruptedSyncs();
        promise.resolve(null);
      } catch (Exception error) {
        databasePath = null;
        reject(promise, error);
      }
    });
  }

  @ReactMethod
  public void configureMockSource(String providerId, Promise promise) {
    writer.execute(() -> configureSource(providerId, "mock", "mock", true, promise));
  }

  @ReactMethod
  public void configureByokSource(String providerId, Promise promise) {
    writer.execute(() -> {
      if (!credentialStore.hasCredential()) {
        promise.reject("credential_missing", "Import a DeBank AccessKey first");
        return;
      }
      configureSource(providerId, "byok", "configured", true, promise);
    });
  }

  @ReactMethod
  public void importDeBankAccessKey(String accessKey, Promise promise) {
    writer.execute(() -> {
      try {
        credentialStore.write(accessKey);
        promise.resolve(credentialState(true));
      } catch (Exception error) {
        reject(promise, error);
      }
    });
  }

  @ReactMethod
  public void clearDeBankAccessKey(Promise promise) {
    writer.execute(() -> {
      try {
        credentialStore.clear();
        withDatabase(database -> database.execSQL(
            "UPDATE portfolio_data_sources SET credential_state = ?, enabled = ?, updated_at = ? " +
                "WHERE provider_id = ? AND mode = ?",
            new Object[] {"missing", 0, System.currentTimeMillis(), PROVIDER_ID, "byok"}));
        promise.resolve(credentialState(false));
      } catch (Exception error) {
        reject(promise, error);
      }
    });
  }

  @ReactMethod
  public void getDeBankCredentialState(Promise promise) {
    promise.resolve(credentialState(credentialStore.hasCredential()));
  }

  @ReactMethod
  public void syncPortfolio(
      String providerId, String address, ReadableMap options, Promise promise) {
    try {
      enqueueSync(providerId, address, optionsJson(options), null, promise);
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  @ReactMethod
  public void syncMockPortfolio(String providerId, String address, Promise promise) {
    enqueueSync(providerId, address, "{\"mode\":\"full\",\"chains\":[]}", "mock", promise);
  }

  @ReactMethod
  public void addListener(String eventName) {}

  @ReactMethod
  public void removeListeners(double count) {}

  private void configureSource(String providerId, String mode, String credentialState,
      boolean enabled, Promise promise) {
    try {
      requireProvider(providerId);
      long updatedAt = System.currentTimeMillis();
      withDatabase(database -> database.execSQL(
          "INSERT OR REPLACE INTO portfolio_data_sources " +
              "(provider_id, mode, credential_state, enabled, updated_at) VALUES (?, ?, ?, ?, ?)",
          new Object[] {providerId, mode, credentialState, enabled ? 1 : 0, updatedAt}));
      WritableMap result = Arguments.createMap();
      result.putString("providerId", providerId);
      result.putString("mode", mode);
      result.putString("credentialState", credentialState);
      result.putBoolean("enabled", enabled);
      result.putDouble("updatedAt", updatedAt);
      promise.resolve(result);
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  private WritableMap credentialState(boolean configured) {
    WritableMap result = Arguments.createMap();
    result.putString("providerId", PROVIDER_ID);
    result.putString("credentialState", configured ? "configured" : "missing");
    return result;
  }

  private void enqueueSync(String providerId, String address, String optionsJson,
      String forcedMode, Promise promise) {
    if (providerId == null || address == null) {
      throw new IllegalArgumentException("invalid_sync_options");
    }
    String normalizedKey = providerId + ":" + address.toLowerCase(Locale.ROOT);
    if (!inFlightSyncs.add(normalizedKey)) {
      promise.reject("sync_already_running", "A portfolio sync is already running");
      return;
    }
    String runId = UUID.randomUUID().toString();
    long queuedAt = System.currentTimeMillis();
    int totalChains = countRequestedChains(optionsJson);
    emitSyncState(providerId, address, runId, "queued", "waiting", 0, totalChains,
        queuedAt, null);
    writer.execute(() -> {
      try {
        runSync(providerId, address, optionsJson, forcedMode, runId, queuedAt, promise);
      } finally {
        inFlightSyncs.remove(normalizedKey);
      }
    });
  }

  private void runSync(String providerId, String address, String optionsJson,
      String forcedMode, String runId, long queuedAt, Promise promise) {
    long startedAt = System.currentTimeMillis();
    int requestedChains = countRequestedChains(optionsJson);
    try {
      requireProvider(providerId);
      writeSyncState(providerId, address, runId, "queued", "waiting", 0,
          requestedChains, queuedAt, 0, queuedAt, null);
      writeSyncState(providerId, address, runId, "running", "portfolio", 0,
          requestedChains, startedAt, 0, startedAt, null);
      emitSyncState(providerId, address, runId, "running", "portfolio", 0,
          requestedChains, startedAt, null);

      String mode = forcedMode == null ? readSourceMode(providerId) : forcedMode;
      String resultJson;
      if ("mock".equals(mode)) {
        resultJson = RubanDataEngineBindings.createMockSyncResultJson(
            address, startedAt, optionsJson);
      } else if ("byok".equals(mode)) {
        if (!credentialStore.hasCredential()) throw new IllegalStateException("credential_missing");
        JSONArray plan = new JSONArray(
            RubanDataEngineBindings.createDeBankRequestPlanJson(address, optionsJson));
        JSONArray payloads = httpClient.execute(plan);
        resultJson = RubanDataEngineBindings.createDeBankSyncResultJson(
            address, startedAt, optionsJson, payloads.toString(), "debank:cloud");
      } else {
        throw new IllegalStateException("data_source_not_configured");
      }

      JSONObject result = new JSONObject(resultJson);
      String normalizedAddress = result.getString("address");
      JSONArray replacedChains = result.getJSONArray("replaceChainIds");
      int completedChains = "full".equals(result.getString("replaceMode"))
          ? result.getJSONArray("chains").length()
          : replacedChains.length();
      long completedAt = System.currentTimeMillis();

      withDatabase(database -> {
        database.beginTransactionNonExclusive();
        try {
          replaceProjection(database, result);
          upsertSyncState(database, providerId, normalizedAddress, runId, "succeeded",
              "complete", completedChains, completedChains, startedAt, completedAt,
              completedAt - startedAt, completedAt, null);
          database.setTransactionSuccessful();
        } finally {
          database.endTransaction();
        }
      });

      emitSyncState(providerId, normalizedAddress, runId, "succeeded", "complete",
          completedChains, completedChains, completedAt, null);
      WritableMap resolved = Arguments.createMap();
      resolved.putString("providerId", providerId);
      resolved.putString("address", normalizedAddress);
      resolved.putString("runId", runId);
      resolved.putInt("completedChains", completedChains);
      resolved.putInt("totalChains", completedChains);
      resolved.putDouble("observedAt", result.getLong("observedAt"));
      resolved.putInt("requestCount", result.getInt("requestCount"));
      resolved.putInt("attemptCount", result.getInt("attemptCount"));
      promise.resolve(resolved);
    } catch (Exception error) {
      long failedAt = System.currentTimeMillis();
      String errorCode = safeErrorCode(error);
      try {
        writeSyncState(providerId, address, runId, "failed", "complete", 0,
            requestedChains, startedAt, failedAt, failedAt, errorCode);
      } catch (Exception ignored) {
      }
      emitSyncState(providerId, address, runId, "failed", "complete", 0,
          requestedChains, failedAt, errorCode);
      reject(promise, error);
    }
  }

  private void replaceProjection(SQLiteDatabase database, JSONObject projection)
      throws Exception {
    String providerId = projection.getString("providerId");
    String address = projection.getString("address");
    long observedAt = projection.getLong("observedAt");
    String replaceMode = projection.getString("replaceMode");
    JSONArray replaceChainIds = projection.getJSONArray("replaceChainIds");
    JSONArray chains = projection.getJSONArray("chains");
    JSONArray tokens = projection.getJSONArray("tokens");
    JSONArray protocols = projection.getJSONArray("protocols");
    Object[] key = new Object[] {providerId, address};

    if ("full".equals(replaceMode)) {
      database.execSQL(
          "DELETE FROM portfolio_token_balances WHERE provider_id = ? AND address = ?", key);
      database.execSQL(
          "DELETE FROM portfolio_protocol_positions WHERE provider_id = ? AND address = ?", key);
      database.execSQL(
          "DELETE FROM portfolio_chain_snapshots WHERE provider_id = ? AND address = ?", key);
    } else if ("chains".equals(replaceMode) && replaceChainIds.length() > 0) {
      for (int index = 0; index < replaceChainIds.length(); index += 1) {
        Object[] chainKey = new Object[] {providerId, address, replaceChainIds.getLong(index)};
        database.execSQL(
            "DELETE FROM portfolio_token_balances " +
                "WHERE provider_id = ? AND address = ? AND chain_id = ?", chainKey);
        database.execSQL(
            "DELETE FROM portfolio_protocol_positions " +
                "WHERE provider_id = ? AND address = ? AND chain_id = ?", chainKey);
        database.execSQL(
            "DELETE FROM portfolio_chain_snapshots " +
                "WHERE provider_id = ? AND address = ? AND chain_id = ?", chainKey);
      }
    } else {
      throw new IllegalArgumentException("provider_contract_invalid");
    }

    database.execSQL(
        "DELETE FROM portfolio_account_snapshots WHERE provider_id = ? AND address = ?", key);
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

  private String readSourceMode(String providerId) throws Exception {
    final String[] mode = new String[1];
    withDatabase(database -> {
      try (Cursor cursor = database.rawQuery(
          "SELECT mode, credential_state, enabled FROM portfolio_data_sources " +
              "WHERE provider_id = ? LIMIT 1", new String[] {providerId})) {
        if (!cursor.moveToFirst()) throw new IllegalStateException("data_source_not_configured");
        if (cursor.getInt(2) != 1) throw new IllegalStateException("data_source_disabled");
        if ("byok".equals(cursor.getString(0)) && !"configured".equals(cursor.getString(1))) {
          throw new IllegalStateException("credential_missing");
        }
        mode[0] = cursor.getString(0);
      }
    });
    return mode[0];
  }

  private String optionsJson(ReadableMap options) {
    try {
      JSONObject output = new JSONObject();
      String mode = options != null && options.hasKey("mode") &&
          options.getType("mode") == ReadableType.String
          ? options.getString("mode") : "full";
      output.put("mode", mode);
      JSONArray chains = new JSONArray();
      if (options != null && options.hasKey("chains") &&
          options.getType("chains") == ReadableType.Array) {
        ReadableArray input = options.getArray("chains");
        if (input != null) {
          for (int index = 0; index < input.size(); index += 1) {
            ReadableMap chain = input.getMap(index);
            if (chain == null) throw new IllegalArgumentException("invalid_sync_options");
            JSONObject encoded = new JSONObject();
            encoded.put("id", (long) chain.getDouble("id"));
            encoded.put("key", chain.getString("key"));
            chains.put(encoded);
          }
        }
      }
      output.put("chains", chains);
      return output.toString();
    } catch (Exception error) {
      throw new IllegalArgumentException("invalid_sync_options", error);
    }
  }

  private int countRequestedChains(String optionsJson) {
    try {
      JSONObject options = new JSONObject(optionsJson);
      JSONArray chains = options.optJSONArray("chains");
      return "incremental".equals(options.optString("mode")) && chains != null
          ? chains.length() : 0;
    } catch (Exception error) {
      return 0;
    }
  }

  private String nullableString(JSONObject value, String key) {
    String result = value.optString(key, "");
    return result.isEmpty() ? null : result;
  }

  private void recoverInterruptedSyncs() throws Exception {
    long recoveredAt = System.currentTimeMillis();
    withDatabase(database -> database.execSQL(
        "UPDATE portfolio_sync_state SET state = ?, stage = ?, completed_at = ?, " +
            "duration_ms = CASE WHEN started_at > 0 THEN MAX(0, ? - started_at) ELSE 0 END, " +
            "updated_at = ?, error_code = ? WHERE state IN (?, ?)",
        new Object[] {"failed", "complete", recoveredAt, recoveredAt, recoveredAt,
            "sync_interrupted", "queued", "running"}));
  }

  private void writeSyncState(String providerId, String address, String runId,
      String state, String stage, int completedChains, int totalChains,
      long startedAt, long completedAt, long updatedAt, String errorCode) throws Exception {
    withDatabase(database -> upsertSyncState(database, providerId, address.toLowerCase(Locale.ROOT),
        runId, state, stage, completedChains, totalChains, startedAt, completedAt,
        completedAt == 0 ? 0 : Math.max(0, completedAt - startedAt), updatedAt, errorCode));
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
    payload.putString("address", address.toLowerCase(Locale.ROOT));
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
    if (!PROVIDER_ID.equals(providerId)) {
      throw new IllegalArgumentException("unsupported_provider");
    }
  }

  private String safeErrorCode(Exception error) {
    String message = error.getMessage();
    if (message != null && SAFE_ERROR_CODES.contains(message)) return message;
    return error instanceof IllegalArgumentException ? "invalid_sync_options" : "data_engine_failed";
  }

  private void reject(Promise promise, Exception error) {
    if ((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      Log.e(MODULE_NAME, "Native data operation failed", error);
    }
    String code = safeErrorCode(error);
    promise.reject(code, "Portfolio data engine failed", error);
  }

  private interface DatabaseOperation {
    void run(SQLiteDatabase database) throws Exception;
  }
}
