# Counter (Vue)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-vue` instead of `effect-cycle-tachys`. This example exists primarily to validate that the renderer-agnostic split (`effect-cycle-dom` for sources, per-renderer packages for sinks) generalizes to Vue 3, and to give Vue users a starting template.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-vue` (vue) |
|--|--|--|
| `h` import | `tachys/sync` | `vue` |
| Sink package | `effect-cycle-tachys` | `effect-cycle-vue` |
| Children syntax | rest args | array |
| Driver | `DOMDriverLive` from tachys | `DOMDriverLive` from vue |

Everything else, the `DOMSource` wiring, the `Ref` for state, the merged event streams, is identical.
