# Counter (Preact)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-preact` instead of `effect-cycle-tachys`. This example exists primarily to validate that the renderer-agnostic split (`effect-cycle-dom` for sources, per-renderer packages for sinks) generalizes beyond tachys, and to give Preact users a starting template.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-preact` (preact) |
|--|--|--|
| `h` import | `tachys/sync` | `preact` |
| Sink package | `effect-cycle-tachys` | `effect-cycle-preact` |
| Class prop | `className` | `class` |
| Driver | `DOMDriverLive` from tachys | `DOMDriverLive` from preact |

Everything else, the `DOMSource` wiring, the `Ref` for state, the merged event streams, is identical.
