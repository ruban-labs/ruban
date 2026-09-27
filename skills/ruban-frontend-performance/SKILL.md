---
name: ruban-frontend-performance
description: Use when changing Ruban React Native screens, hooks, state subscriptions, selectors, navigation loading, high-cardinality lists, remote images, database projections, render timing, or frontend performance instrumentation.
---

# Ruban Frontend Performance

Keep product code fast by controlling when work runs, how often it runs, where
it runs, and how widely each result is published. Do not start with blanket
memoization.

## Classify the change

Before editing a hot path, record the affected dimensions:

| Dimension   | Question                                                                     |
| ----------- | ---------------------------------------------------------------------------- |
| Timing      | Does it run during module load, startup, first paint, focus, or user demand? |
| Frequency   | Does it run once, per event, per row, per frame, or per render?              |
| Thread      | Does it consume the React JS thread, a worker, Native, or storage?           |
| Fanout      | How many mounted consumers receive the update?                               |
| Lifecycle   | Does it keep publishing while its screen or Sheet is hidden?                 |
| Correctness | Could deferral, batching, or cancellation expose stale or partial state?     |

Fix the largest unnecessary frequency or fanout before micro-optimizing the
body of the work.

## State and subscriptions

- Subscribe at the lowest owner that needs the value. Do not make a screen
  observe an entire global object when it renders two fields.
- Publish one coherent view state per source event. Avoid a chain of independent
  setters for fields that describe one synchronization state.
- Return stable identities for unchanged arrays, objects, callbacks, and
  selectors. Never rebuild a collection merely to pass it through a hook.
- Keep high-frequency progress local to its indicator. Durable portfolio data
  and transient sync progress are separate publication channels.
- Compare compact semantic state before publishing. Repeated native events with
  the same visible meaning must not schedule another React update.
- Keep source-of-truth work running when required, but pause React publication
  for hidden screens. A hidden modal or control-plane owner may stay mounted
  only when its lifecycle contract requires it.

## Derived work

- Hoist stateless formatters, regular expressions, lookup tables, and immutable
  registries to module scope.
- Memoize sorting, filtering, grouping, and map construction only when their
  inputs are stable and the computation or identity matters.
- Compute shared projections once above repeated rows. Do not repeat currency,
  date, or allocation setup inside each item render.
- Move byte-heavy parsing, database writes, compression, and crypto away from
  the React thread. Keep small presentation transforms in TypeScript.

## High-cardinality collections

- Use `FlatList` or `SectionList` for any collection that can grow with remote
  data. Never place a virtualized collection inside a same-axis `ScrollView`.
- Use stable domain keys, bounded `initialNumToRender`, bounded batch size, and
  a deliberately small window. Add `getItemLayout` only when row geometry is
  genuinely fixed and measured.
- Keep row props narrow and stable. Memoize a row only after its parent can
  preserve those props; otherwise memoization adds comparison work without
  reducing renders.
- Publish database/network results as coherent batches. Do not bridge or commit
  one React-visible update per asset.
- Preserve scrolling and selection behavior across refreshes. A new snapshot
  must not remount the whole screen without a product reason.

## Remote images

- Persist the canonical image URL with the asset record and render a stable
  local fallback immediately.
- Give every image fixed geometry so loading cannot relayout the list.
- Let list virtualization bound visible image requests. Do not prefetch an
  unbounded portfolio or mount hidden images to warm a cache.
- Use the platform image cache and zero-cost transitions by default. Add a
  specialized image library only after release evidence shows the platform
  path is insufficient.
- Keep failure state scoped to the URL. A changed URL must be allowed to load,
  and failed images must retain an accessible, deterministic fallback.

## Navigation and imports

- Keep module top levels free of IO, large parsing, subscriptions, and eager
  singleton construction.
- Lazy-load route-sized feature code when it materially reduces startup work;
  do not split tiny components into asynchronous noise.
- Avoid barrel imports on hot startup paths when they pull unrelated modules.
- Treat new import cycles as failures. Break cycles at feature boundaries or
  move pure shared contracts downward.

## Database and Native publication

- Native synchronization owns network concurrency, cancellation, transaction
  boundaries, and durable writes.
- JavaScript reads a committed snapshot and compact sync state; it does not
  mirror Native row-by-row ingestion.
- Keep database readers query-shaped: request only the address, chain, columns,
  sort, and limit needed by the current surface.
- Prefer one transaction and one terminal publication over many individually
  observable writes. Thread safety and coherent reads outrank peak concurrency.

## Evidence

Use low-overhead measurements with stable labels:

- render count for the affected screen and expensive rows;
- mounted row/image count for large lists;
- source event count versus React publication count;
- JS frame stalls and native frame timing during scroll and refresh;
- cold/warm startup markers for import or navigation changes.

Development builds prove behavior and reveal obvious fanout. Performance claims
require a release-like Hermes build on a capability-compatible physical device.
Remove temporary visual/debug instrumentation before merging unless it is a
bounded development-only diagnostic surface.

## Change workflow

1. Capture the current slow interaction and identify its timing, frequency,
   thread, fanout, lifecycle, and correctness boundary.
2. Fix ownership and publication first, collection windowing second, repeated
   computation third, and memoization last.
3. Run focused pure tests and typecheck.
4. Verify the complete interaction on a real device, including refresh,
   navigation away/back, theme change, empty data, and image failure.
5. Use a release-like Hermes artifact before recording a performance result.
