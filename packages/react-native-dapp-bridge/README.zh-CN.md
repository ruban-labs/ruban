# @ruban-labs/react-native-dapp-bridge

[English](./README.md)

面向 React Native WebView 的类型化 EIP-1193 content script、EIP-6963 钱包发现
声明与宿主通信协议。生成的脚本通过 `injectedJavaScriptBeforeContentLoaded`
提前注入，宿主解析请求，再用包内生成的回复脚本返回结果。

这个包不决定钱包权限、不签名，也不选择 RPC 节点。可信 origin 必须来自宿主掌握的
顶层导航状态，网页自己上报的来源永远不作为权限依据。

Provider Runtime 以静态 JavaScript 交付，不在运行时调用 `Function#toString`。
Hermes 可能把编译后的函数序列化成不可执行的 bytecode 占位文本。每个请求同时携带
宿主会话 ID 与页面文档 ID；回复必须命中这一对标识，已经离开的旧页面即使晚到回包，
也不能误触发新页面里复用的请求编号。

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

`DappBridgeHostSession` 会拒绝旧文档、重复请求 ID、超过并发上限的请求，以及超过单页
总量上限的请求。content script 还会拒绝超过配置时限仍未完成的请求。

预注入脚本保留 `window.ethereum` 兼容旧 DApp，同时通过
`eip6963:announceProvider` 发布同一个 Provider；DApp 发出
`eip6963:requestProvider` 后会再次发布。宿主传入钱包名称、`rdns` 与 Base64 PNG、
WebP 或 SVG data URI，因此 production、regression、debug 可以使用各自对应的 App
图标。每个 WebView 文档会生成新的 EIP-6963 UUID。
