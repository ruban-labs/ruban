export type ProviderContentScriptOptions = {
  sessionId: string;
  providerInfo: Eip6963ProviderMetadata;
  requestTimeoutMs?: number;
};

export type Eip6963ProviderMetadata = Readonly<{
  name: string;
  icon: string;
  rdns: string;
}>;

const providerRuntime = String.raw`
function installRubanProvider(config) {
  var page = window;
  var nextId = 1;
  var pending = {};
  var listeners = {};
  var documentId = createDocumentId();

  function createDocumentId() {
    var cryptoObject = page.crypto;
    if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
      var values = new Uint32Array(4);
      cryptoObject.getRandomValues(values);
      var output = '';
      for (var index = 0; index < values.length; index += 1) {
        var part = values[index].toString(16);
        output += ('00000000' + part).slice(-8);
      }
      return output;
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function createProviderUuid() {
    var bytes = new Uint8Array(16);
    var cryptoObject = page.crypto;
    if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
      cryptoObject.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = [];
    for (var byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
      hex.push(('0' + bytes[byteIndex].toString(16)).slice(-2));
    }
    return hex.slice(0, 4).join('') + '-' +
      hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' +
      hex.slice(8, 10).join('') + '-' +
      hex.slice(10, 16).join('');
  }

  function emit(event, args) {
    var handlers = listeners[event] || [];
    handlers.slice().forEach(function (handler) {
      handler.apply(null, args);
    });
  }

  function request(args) {
    if (!args || typeof args.method !== 'string') {
      return Promise.reject(new Error('EIP-1193 request requires a method'));
    }
    if (!page.ReactNativeWebView) {
      return Promise.reject(new Error('Ruban host bridge is unavailable'));
    }
    return new Promise(function (resolve, reject) {
      var id = nextId;
      nextId += 1;
      var payload;
      try {
        payload = JSON.stringify({
          channel: config.channel,
          sessionId: config.sessionId,
          documentId: documentId,
          id: id,
          method: args.method,
          params: Array.isArray(args.params) ? args.params : []
        });
      } catch (error) {
        reject(new Error('Provider params must be serializable'));
        return;
      }
      var timer = setTimeout(function () {
        if (!pending[id]) return;
        delete pending[id];
        var failure = new Error('Provider request timed out');
        failure.code = -32000;
        reject(failure);
      }, config.requestTimeoutMs);
      pending[id] = {resolve: resolve, reject: reject, timer: timer};
      try {
        page.ReactNativeWebView.postMessage(payload);
      } catch (error) {
        clearTimeout(timer);
        delete pending[id];
        reject(new Error('Ruban host bridge is unavailable'));
      }
    });
  }

  window.addEventListener('__ruban_rpc_response__', function (event) {
    var message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }
    if (message.sessionId !== config.sessionId || message.documentId !== documentId) return;
    if (message.event) {
      emit(message.event, Array.isArray(message.args) ? message.args : []);
      return;
    }
    if (typeof message.id !== 'number' || !pending[message.id]) return;
    var task = pending[message.id];
    delete pending[message.id];
    clearTimeout(task.timer);
    if (message.error) {
      var failure = new Error(message.error.message || 'Provider request failed');
      failure.code = message.error.code;
      task.reject(failure);
    } else {
      task.resolve(message.result);
    }
  });

  var provider = {
    isRuban: true,
    request: request,
    on: function (event, listener) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
      return provider;
    },
    removeListener: function (event, listener) {
      listeners[event] = (listeners[event] || []).filter(function (candidate) {
        return candidate !== listener;
      });
      return provider;
    }
  };

  var providerInfo = Object.freeze({
    uuid: createProviderUuid(),
    name: config.providerInfo.name,
    icon: config.providerInfo.icon,
    rdns: config.providerInfo.rdns
  });
  var providerDetail = Object.freeze({
    info: providerInfo,
    provider: provider
  });

  function announceProvider() {
    if (typeof page.CustomEvent !== 'function' || typeof page.dispatchEvent !== 'function') return;
    page.dispatchEvent(new page.CustomEvent('eip6963:announceProvider', {
      detail: providerDetail
    }));
  }

  try {
    Object.defineProperty(page, 'ethereum', {
      value: provider,
      configurable: false,
      writable: false
    });
  } catch (error) {
    page.ethereum = provider;
  }

  window.addEventListener('eip6963:requestProvider', announceProvider);
  announceProvider();
}
`;

export function createProviderContentScript(
  options: ProviderContentScriptOptions
): string {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(options.sessionId)) {
    throw new Error(
      "Provider sessionId must contain 8-128 URL-safe characters"
    );
  }
  const config = {
    channel: "ruban-eip1193-v1",
    sessionId: options.sessionId,
    providerInfo: normalizeProviderInfo(options.providerInfo),
    requestTimeoutMs: normalizeRequestTimeout(options.requestTimeoutMs),
  };
  return `${providerRuntime}\ninstallRubanProvider(${JSON.stringify(
    config
  )});true;`;
}

function normalizeProviderInfo(
  value: Eip6963ProviderMetadata
): Eip6963ProviderMetadata {
  if (
    !value ||
    typeof value.name !== "string" ||
    typeof value.icon !== "string" ||
    typeof value.rdns !== "string"
  ) {
    throw new Error("Provider info must include name, icon, and rdns");
  }
  const name = value.name.trim();
  if (!name || name.length > 64) {
    throw new Error("Provider name must contain 1-64 characters");
  }
  if (
    !/^data:image\/(?:png|webp|svg\+xml);base64,[a-zA-Z0-9+/]+={0,2}$/.test(
      value.icon
    ) ||
    value.icon.length > 262144
  ) {
    throw new Error(
      "Provider icon must be a base64 PNG, WebP, or SVG data URI"
    );
  }
  const rdns = value.rdns.toLowerCase();
  if (
    rdns.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      rdns
    )
  ) {
    throw new Error("Provider rdns must be a valid reverse DNS name");
  }
  return { name, icon: value.icon, rdns };
}

function normalizeRequestTimeout(value: number | undefined): number {
  return Number.isSafeInteger(value) &&
    (value as number) >= 1000 &&
    (value as number) <= 120000
    ? (value as number)
    : 30000;
}
