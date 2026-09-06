package com.rubanlabs.dataengine;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class RubanDeBankCredentialStore {
  private static final String ANDROID_KEY_STORE = "AndroidKeyStore";
  private static final String KEY_ALIAS = "com.rubanlabs.dataengine.debank.access-key";
  private static final String PREFERENCES = "ruban_data_engine_credentials";
  private static final String CIPHERTEXT = "debank_access_key_ciphertext";
  private static final String IV = "debank_access_key_iv";
  private final SharedPreferences preferences;

  RubanDeBankCredentialStore(Context context) {
    preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
  }

  synchronized void write(String accessKey) throws Exception {
    requireAvailable();
    if (accessKey == null || accessKey.isEmpty() || accessKey.length() > 4096 ||
        accessKey.indexOf('\0') >= 0) {
      throw new IllegalArgumentException("invalid_access_key");
    }
    byte[] plaintext = accessKey.getBytes(StandardCharsets.UTF_8);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
      byte[] encrypted = cipher.doFinal(plaintext);
      boolean committed = preferences.edit()
          .putString(CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
          .putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
          .commit();
      Arrays.fill(encrypted, (byte) 0);
      if (!committed) throw new IllegalStateException("credential_store_failed");
    } finally {
      Arrays.fill(plaintext, (byte) 0);
    }
  }

  synchronized String read() throws Exception {
    requireAvailable();
    String ciphertext = preferences.getString(CIPHERTEXT, null);
    String iv = preferences.getString(IV, null);
    if (ciphertext == null || iv == null) {
      throw new IllegalStateException("credential_missing");
    }
    byte[] encrypted = Base64.decode(ciphertext, Base64.NO_WRAP);
    byte[] initializationVector = Base64.decode(iv, Base64.NO_WRAP);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, getExistingKey(),
          new GCMParameterSpec(128, initializationVector));
      byte[] plaintext = cipher.doFinal(encrypted);
      try {
        return new String(plaintext, StandardCharsets.UTF_8);
      } finally {
        Arrays.fill(plaintext, (byte) 0);
      }
    } catch (Exception error) {
      throw new IllegalStateException("credential_unavailable", error);
    } finally {
      Arrays.fill(encrypted, (byte) 0);
      Arrays.fill(initializationVector, (byte) 0);
    }
  }

  synchronized boolean hasCredential() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;
    if (!preferences.contains(CIPHERTEXT) || !preferences.contains(IV)) return false;
    try {
      return getExistingKey() != null;
    } catch (Exception error) {
      return false;
    }
  }

  synchronized void clear() throws Exception {
    boolean committed = preferences.edit().remove(CIPHERTEXT).remove(IV).commit();
    KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
    keyStore.load(null);
    if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
    if (!committed) throw new IllegalStateException("credential_clear_failed");
  }

  private SecretKey getOrCreateKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
    keyStore.load(null);
    java.security.Key existing = keyStore.getKey(KEY_ALIAS, null);
    if (existing instanceof SecretKey) return (SecretKey) existing;
    KeyGenerator generator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE);
    generator.init(new KeyGenParameterSpec.Builder(
        KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build());
    return generator.generateKey();
  }

  private SecretKey getExistingKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance(ANDROID_KEY_STORE);
    keyStore.load(null);
    java.security.Key key = keyStore.getKey(KEY_ALIAS, null);
    if (!(key instanceof SecretKey)) {
      throw new IllegalStateException("credential_unavailable");
    }
    return (SecretKey) key;
  }

  private void requireAvailable() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      throw new IllegalStateException("secure_storage_unavailable");
    }
  }
}
