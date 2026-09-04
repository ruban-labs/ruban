package com.rubanlabs.walletcore;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.util.Base64;
import android.widget.EditText;
import android.widget.TextView;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONException;
import org.json.JSONObject;

public final class RubanWalletCoreModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "RubanWalletCore";
  private static final String PREFS_NAME = "ruban_wallet_core";
  private static final String SECRET_PREFIX = "secret:";
  private static final String DEFAULT_PATH = "m/44'/60'/0'/0/0";
  private final ReactApplicationContext context;
  private final SharedPreferences preferences;

  RubanWalletCoreModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
    this.preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void presentCreateMnemonic(String label, Promise promise) {
    try {
      JSONObject generated = invoke("generateMnemonic", new JSONObject());
      String phrase = generated.getString("phrase");
      Activity activity = requireActivity();
      activity.runOnUiThread(() -> {
        TextView content = new TextView(activity);
        int padding = Math.round(24 * activity.getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding / 2, padding, padding / 2);
        content.setText(phrase);
        content.setTextIsSelectable(true);
        new AlertDialog.Builder(activity)
            .setTitle("Recovery phrase")
            .setMessage("Write these 12 words down in order. They are shown only during this native flow.")
            .setView(content)
            .setNegativeButton("Cancel", (dialog, which) -> promise.reject("cancelled", "Wallet creation cancelled"))
            .setPositiveButton("Store wallet", (dialog, which) -> createSecretAccount(label, "mnemonic", phrase, DEFAULT_PATH, promise))
            .setOnCancelListener(dialog -> promise.reject("cancelled", "Wallet creation cancelled"))
            .show();
      });
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  @ReactMethod
  public void presentImportMnemonic(String label, Promise promise) {
    presentSecretInput("Import recovery phrase", "12 or 24 words", value ->
        createSecretAccount(label, "mnemonic", value, DEFAULT_PATH, promise), promise);
  }

  @ReactMethod
  public void presentImportPrivateKey(String label, Promise promise) {
    presentSecretInput("Import private key", "0x…", value ->
        createSecretAccount(label, "private-key", value, null, promise), promise);
  }

  @ReactMethod
  public void addWatchOnly(String label, String address, Promise promise) {
    try {
      JSONObject params = new JSONObject().put("address", address);
      String normalized = invoke("normalizeAddress", params).getString("address");
      JSONObject account = new JSONObject()
          .put("id", UUID.randomUUID().toString())
          .put("label", normalizedLabel(label, "Watch account"))
          .put("address", normalized)
          .put("kind", "watch-only")
          .put("createdAt", System.currentTimeMillis());
      promise.resolve(toWritableAccount(account));
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  @ReactMethod
  public void deleteSecret(String accountId, Promise promise) {
    preferences.edit().remove(SECRET_PREFIX + accountId).apply();
    promise.resolve(null);
  }

  @ReactMethod
  public void signPersonalMessage(String accountId, String messageHex, ReadableMap requestContext, Promise promise) {
    confirmSigning(accountId, requestContext, "Sign message", secret -> {
      JSONObject params = secretParams(secret).put("messageHex", messageHex);
      return invoke("signPersonalMessage", params).getString("signature");
    }, promise);
  }

  @ReactMethod
  public void signTypedData(String accountId, String typedDataJson, ReadableMap requestContext, Promise promise) {
    confirmSigning(accountId, requestContext, "Sign typed data", secret -> {
      JSONObject params = secretParams(secret).put("typedData", new JSONObject(typedDataJson));
      return invoke("signTypedData", params).getString("signature");
    }, promise);
  }

  @ReactMethod
  public void signEip1559Transaction(String accountId, ReadableMap transaction, ReadableMap requestContext, Promise promise) {
    confirmSigning(accountId, requestContext, "Sign transaction", secret -> {
      JSONObject params = secretParams(secret).put("transaction", new JSONObject(transaction.toHashMap()));
      JSONObject signed = invoke("signEip1559Transaction", params);
      WritableMap result = Arguments.createMap();
      result.putString("rawTransaction", signed.getString("rawTransaction"));
      result.putString("transactionHash", signed.getString("transactionHash"));
      return result;
    }, promise);
  }

  private void presentSecretInput(String title, String hint, SecretConsumer consumer, Promise promise) {
    try {
      Activity activity = requireActivity();
      activity.runOnUiThread(() -> {
        EditText input = new EditText(activity);
        input.setHint(hint);
        input.setSingleLine(false);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        new AlertDialog.Builder(activity)
            .setTitle(title)
            .setView(input)
            .setNegativeButton("Cancel", (dialog, which) -> promise.reject("cancelled", "Import cancelled"))
            .setPositiveButton("Import", (dialog, which) -> {
              String value = input.getText().toString();
              input.getText().clear();
              consumer.accept(value);
            })
            .setOnCancelListener(dialog -> promise.reject("cancelled", "Import cancelled"))
            .show();
      });
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  private void createSecretAccount(String label, String kind, String secret, String derivationPath, Promise promise) {
    try {
      JSONObject params = new JSONObject().put("kind", kind).put("secret", secret);
      if (derivationPath != null) params.put("derivationPath", derivationPath);
      JSONObject derived = invoke("deriveAccount", params);
      String id = UUID.randomUUID().toString();
      JSONObject account = new JSONObject()
          .put("id", id)
          .put("label", normalizedLabel(label, "Account"))
          .put("address", derived.getString("address"))
          .put("kind", kind)
          .put("createdAt", System.currentTimeMillis());
      if (derivationPath != null) account.put("derivationPath", derivationPath);
      writeEncryptedSecret(id, kind, derivationPath, secret);
      promise.resolve(toWritableAccount(account));
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  private void confirmSigning(String accountId, ReadableMap requestContext, String title, Signer signer, Promise promise) {
    try {
      if (!preferences.contains(SECRET_PREFIX + accountId)) {
        throw new WalletException("secret_not_found", "Account secret not found");
      }
      Activity activity = requireActivity();
      String origin = requestContext.hasKey("origin") ? requestContext.getString("origin") : "Unknown origin";
      String chain = requestContext.hasKey("chainId") ? String.valueOf((long) requestContext.getDouble("chainId")) : "Unknown";
      String address = requestContext.hasKey("accountAddress") ? requestContext.getString("accountAddress") : accountId;
      String message = origin + "\nChain ID " + chain + "\n\n" + address;
      activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
          .setTitle(title)
          .setMessage(message)
          .setNegativeButton("Reject", (dialog, which) -> promise.reject("user_rejected", "Signing request rejected"))
          .setPositiveButton("Confirm", (dialog, which) -> {
            try {
              SecretRecord secret = readEncryptedSecret(accountId);
              Object result = signer.sign(secret);
              secret.clear();
              promise.resolve(result);
            } catch (Exception error) {
              reject(promise, error);
            }
          })
          .setOnCancelListener(dialog -> promise.reject("user_rejected", "Signing request rejected"))
          .show());
    } catch (Exception error) {
      reject(promise, error);
    }
  }

  private JSONObject secretParams(SecretRecord secret) throws JSONException {
    JSONObject params = new JSONObject().put("kind", secret.kind).put("secret", secret.value);
    if (secret.derivationPath != null) params.put("derivationPath", secret.derivationPath);
    return params;
  }

  private JSONObject invoke(String operation, JSONObject params) throws Exception {
    JSONObject request = new JSONObject().put("operation", operation).put("params", params);
    JSONObject response = new JSONObject(RubanWalletCoreBindings.invoke(request.toString()));
    if (!response.optBoolean("ok")) {
      JSONObject error = response.optJSONObject("error");
      throw new WalletException(
          error == null ? "native_error" : error.optString("code", "native_error"),
          error == null ? "Wallet core failed" : error.optString("message", "Wallet core failed"));
    }
    return response.getJSONObject("result");
  }
  private WritableMap toWritableAccount(JSONObject account) {
    WritableMap result = Arguments.createMap();
    result.putString("id", account.optString("id"));
    result.putString("label", account.optString("label"));
    result.putString("address", account.optString("address"));
    result.putString("kind", account.optString("kind"));
    if (account.has("derivationPath")) result.putString("derivationPath", account.optString("derivationPath"));
    result.putDouble("createdAt", account.optLong("createdAt"));
    return result;
  }

  private void writeEncryptedSecret(String accountId, String kind, String derivationPath, String secret) throws Exception {
    requireModernKeystore();
    JSONObject plaintext = new JSONObject().put("kind", kind).put("value", secret);
    if (derivationPath != null) plaintext.put("derivationPath", derivationPath);
    byte[] bytes = plaintext.toString().getBytes(StandardCharsets.UTF_8);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
      cipher.updateAAD(accountId.getBytes(StandardCharsets.UTF_8));
      byte[] encrypted = cipher.doFinal(bytes);
      JSONObject envelope = new JSONObject()
          .put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
          .put("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP));
      preferences.edit().putString(SECRET_PREFIX + accountId, envelope.toString()).apply();
      Arrays.fill(encrypted, (byte) 0);
    } finally {
      Arrays.fill(bytes, (byte) 0);
    }
  }

  private SecretRecord readEncryptedSecret(String accountId) throws Exception {
    requireModernKeystore();
    String stored = preferences.getString(SECRET_PREFIX + accountId, null);
    if (stored == null) throw new WalletException("secret_not_found", "Account secret not found");
    JSONObject envelope = new JSONObject(stored);
    byte[] iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
    byte[] encrypted = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
    cipher.updateAAD(accountId.getBytes(StandardCharsets.UTF_8));
    byte[] plaintext = cipher.doFinal(encrypted);
    try {
      JSONObject secret = new JSONObject(new String(plaintext, StandardCharsets.UTF_8));
      return new SecretRecord(secret.getString("kind"), secret.optString("derivationPath", null), secret.getString("value"));
    } finally {
      Arrays.fill(iv, (byte) 0);
      Arrays.fill(encrypted, (byte) 0);
      Arrays.fill(plaintext, (byte) 0);
    }
  }

  private SecretKey getOrCreateKey() throws Exception {
    String alias = "ruban-wallet-core:" + context.getPackageName();
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    if (keyStore.containsAlias(alias)) return ((KeyStore.SecretKeyEntry) keyStore.getEntry(alias, null)).getSecretKey();
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build());
    return generator.generateKey();
  }

  private void requireModernKeystore() throws WalletException {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      throw new WalletException("unsupported_os", "Secure wallet storage requires Android 6 or newer");
    }
  }

  private Activity requireActivity() throws WalletException {
    Activity activity = getCurrentActivity();
    if (activity == null) throw new WalletException("activity_unavailable", "No active screen is available");
    return activity;
  }

  private String normalizedLabel(String label, String fallback) {
    String value = label == null ? "" : label.trim();
    return value.isEmpty() ? fallback : value;
  }

  private void reject(Promise promise, Exception error) {
    if (error instanceof WalletException) {
      WalletException walletError = (WalletException) error;
      promise.reject(walletError.code, walletError.getMessage(), walletError);
    } else {
      promise.reject("wallet_core_failed", error.getMessage(), error);
    }
  }

  private interface SecretConsumer { void accept(String value); }
  private interface Signer { Object sign(SecretRecord secret) throws Exception; }

  private static final class WalletException extends Exception {
    final String code;
    WalletException(String code, String message) { super(message); this.code = code; }
  }

  private static final class SecretRecord {
    final String kind;
    final String derivationPath;
    String value;
    SecretRecord(String kind, String derivationPath, String value) {
      this.kind = kind;
      this.derivationPath = derivationPath;
      this.value = value;
    }
    void clear() { value = ""; }
  }
}
