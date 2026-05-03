# Counter (React)

The same counter as [`examples/counter`](../counter), but rendered through `effect-cycle-react` instead of `effect-cycle-tachys`. Demonstrates that the renderer-package contract works with React 18+ via `react-dom/client`'s `createRoot`. Each emission is wrapped in `flushSync` so the DOM updates synchronously, matching the behavior of the tachys, morphdom, and Preact sinks.

## Getting started

```sh
pnpm dev
```

## What's different from `examples/counter`

| | `examples/counter` (tachys) | `examples/counter-react` (react) |
|--|--|--|
| `h` import | `tachys/sync` | `createElement as h` from `react` |
| Sink package | `effect-cycle-tachys` | `effect-cycle-react` |
| Class prop | `className` | `className` |
| Driver | `DOMDriverLive` from tachys | `DOMDriverLive` from react |
| Mount API | `tachys.createRoot` | `react-dom/client.createRoot` |

Everything else, the `DOMSource` wiring, the `Ref` for state, the merged event streams, is identical.
