# @ruban-labs/react-native-dapp-bridge

[中文](./README.zh-CN.md)

A typed EIP-1193 content script, EIP-6963 discovery announcement, and host
protocol for React Native WebView. Inject the generated script with
`injectedJavaScriptBeforeContentLoaded`, parse messages on the native side, and
return responses with the generated reply script.

The bridge never decides wallet permissions, signs data, or selects RPC nodes.
The host must derive the trusted origin from its own top-level navigation state;
page-supplied origin values are never authoritative.

The provider runtime is shipped as static JavaScript instead of being created
with `Function#toString`. Hermes may stringify compiled functions as bytecode
placeholders, which are not valid WebView scripts. Every request carries both
a host session ID and a document ID. Replies target that exact pair so a late
response from a page that navigated away cannot resolve a request in the new
document.

```tsx
const sessionId = createSessionId();
const preload = createProviderContentScript({
  sessionId,
  providerInfo: {
    name: "Ruban Dev",
    icon: debugIconBase64DataUri,
    rdns: "work.ruban-labs.mobile.debug",
  },
});
const bridge = new DappBridgeHostSession(sessionId);

<WebView
  injectedJavaScriptBeforeContentLoaded={preload}
  injectedJavaScriptBeforeContentLoadedForMainFrameOnly
  onLoadStart={() => bridge.beginNavigation()}
  onMessage={(event) => {
    const request = bridge.parse(event.nativeEvent.data);
    const origin = trustedTopLevelOrigin.current;
    handleProviderRequest(origin, request)
      .then((result) =>
        webView.current?.injectJavaScript(
          createBridgeResponseScript(request, { id: request.id, result })
        )
      )
      .finally(() => bridge.complete(request));
  }}
/>;
```

`DappBridgeHostSession` rejects stale documents, duplicate request IDs,
excessive pending work, and documents that exceed their bounded request count.
The content script also rejects requests that remain unresolved past its
configured timeout.

The preload keeps `window.ethereum` for legacy DApps and announces the same
provider through `eip6963:announceProvider`. It re-announces when a DApp emits
`eip6963:requestProvider`. The host supplies `name`, `rdns`, and a base64 PNG,
WebP, or SVG data URI, so production, regression, and debug builds can expose
their matching app icon. A fresh EIP-6963 UUID is generated for every WebView
document.
