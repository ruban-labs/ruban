# @ruban-labs/react-native-evm-client

[中文](./README.zh-CN.md)

Fast EVM RPC and portfolio primitives for bare React Native. The package races
healthy endpoints, coalesces duplicate requests, batches balance reads, and
emits chain results incrementally so applications can render cached data first
and replace it without waiting for the slowest network.

The built-in chain list is a replaceable default. Production applications
should review their own node, indexer, and price-source terms and capacity.

Every RPC request declares whether it comes from an app feature or a browser
session. The two sources use independent concurrency lanes, in-flight request
namespaces, and endpoint health scores. Source metadata remains local and is
never included in the JSON-RPC payload sent to a public endpoint.
