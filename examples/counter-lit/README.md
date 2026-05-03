# Counter (lit-html)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-lit` instead of `effect-cycle-tachys`. This example exists primarily to validate that the renderer-agnostic split (`effect-cycle-dom` for sources, per-renderer packages for sinks) generalizes to lit-html's tagged-template authoring style, and to give lit users a starting template.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-lit` (lit-html) |
|--|--|--|
| View import | `h` from `tachys/sync` | `html` from `lit-html` |
| Sink package | `effect-cycle-tachys` | `effect-cycle-lit` |
| View syntax | function calls (`h("div", ...)`) | tagged templates (`` html`<div>...</div>` ``) |
| Driver | `DOMDriverLive` from tachys | `DOMDriverLive` from lit |

Everything else, the `DOMSource` wiring, the `Ref` for state, the merged event streams, is identical.
