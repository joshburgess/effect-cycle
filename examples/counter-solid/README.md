# Counter (Solid)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-solid` instead of `effect-cycle-tachys`. This example exists primarily to validate that Solid's signal-based fine-grained reactivity composes with effect-cycle's renderer-agnostic `DOMSource`, and to give Solid users a starting template.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-solid` (solid) |
|--|--|--|
| Sink contract | `DOMSink` (stream of VNodes) | `ReactiveSink` (mount-once + signals) |
| Sink package | `effect-cycle-tachys` | `effect-cycle-solid` |
| Element factory | `h` from `tachys/sync` | JSX (compiled by `vite-plugin-solid`) |
| Update strategy | re-render whole tree, diff | mount once, per-signal-read text updates |
| Driver | `DOMDriverLive` | `ReactiveDriverLive` |

The Effect side, the `DOMSource` event capture, the `Ref` for state, the merged event streams, is identical. The only Solid-specific calls are:

- `ReactiveSink.fromStream(count$, 0)` to bridge the merged stream into a Solid `Accessor<number>`
- `ReactiveSink.render(component)` to mount once

Calling the accessor inside JSX (`{count()}`) is what wires up Solid's fine-grained reactivity: subsequent stream emissions update only the affected text node, not the whole tree.

## Why a separate sink contract?

The VDOM-style `DOMSink` accepts a `Stream<VNode>`, which works for renderers that diff full trees on every emission (morphdom, tachys, preact, react, lit-html, vue). Pushing whole trees through Solid would defeat its compile-time-tracked, per-signal update path: Solid would re-create the tree on every emission and undo its main performance win.

`ReactiveSink` keeps the renderer-agnostic source side (`DOMSource` and the rest of `effect-cycle-dom`) while exposing a contract that fits Solid's mount-once model.
