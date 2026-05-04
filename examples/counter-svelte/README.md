# Counter (Svelte)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-svelte` instead of `effect-cycle-tachys`. Validates that Svelte 5's signal/store-based reactivity composes with effect-cycle's renderer-agnostic `DOMSource`, and gives Svelte users a starting template.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-svelte` (svelte) |
|--|--|--|
| Sink contract | `DOMSink` (stream of VNodes) | `ReactiveSink` (mount-once + stores) |
| Sink package | `effect-cycle-tachys` | `effect-cycle-svelte` |
| View layer | `h(...)` from `tachys/sync` | `Counter.svelte` (compiled by `vite-plugin-svelte`) |
| Update strategy | re-render whole tree, diff | mount once, subscribe to store, fine-grained text update |
| Driver | `DOMDriverLive` | `ReactiveDriverLive` |

The Effect side, the `DOMSource` event capture, the `Ref` for state, the merged event streams, is identical. The only Svelte-specific calls are:

- `ReactiveSink.fromStream(count$, 0)` to bridge the merged stream into a Svelte `Readable<number>` store
- `ReactiveSink.mount(Counter, { count })` to mount the component once with the store as a prop

Inside `Counter.svelte`, `{$count}` subscribes the interpolated text node to the store: subsequent stream emissions update only that node, not the whole tree.

## Why a separate sink contract?

The VDOM-style `DOMSink` accepts a `Stream<VNode>`, which works for renderers that diff full trees on every emission (morphdom, tachys, preact, react, lit-html, vue). Pushing whole trees through Svelte would defeat its compile-time-tracked, per-binding update path: Svelte would re-mount on every emission and undo its main performance win.

`ReactiveSink` keeps the renderer-agnostic source side (`DOMSource` and the rest of `effect-cycle-dom`) while exposing a contract that fits Svelte's mount-once model. The same shape is used by `effect-cycle-solid`.
