package com.rubanlabs.dataengine;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

final class RubanSyncCancellation {
  private final Set<HttpURLConnection> connections = new HashSet<>();
  private volatile String reason;

  boolean cancel(String cancellationReason) {
    synchronized (connections) {
      if (reason != null) return false;
      reason = cancellationReason;
    }
    abortActiveRequests();
    return true;
  }

  boolean isCancelled() {
    return reason != null;
  }

  String reason() {
    String current = reason;
    return current == null ? "sync_cancelled" : current;
  }

  void throwIfCancelled() throws IOException {
    if (isCancelled()) throw new IOException(reason());
  }

  void register(HttpURLConnection connection) throws IOException {
    synchronized (connections) {
      if (reason != null) {
        connection.disconnect();
        throw new IOException(reason);
      }
      connections.add(connection);
    }
  }

  void unregister(HttpURLConnection connection) {
    synchronized (connections) {
      connections.remove(connection);
    }
  }

  void abortActiveRequests() {
    ArrayList<HttpURLConnection> active;
    synchronized (connections) {
      active = new ArrayList<>(connections);
    }
    for (HttpURLConnection connection : active) connection.disconnect();
  }

  void sleep(long delayMs) throws Exception {
    long remaining = delayMs;
    while (remaining > 0) {
      throwIfCancelled();
      long interval = Math.min(remaining, 50);
      Thread.sleep(interval);
      remaining -= interval;
    }
    throwIfCancelled();
  }
}
