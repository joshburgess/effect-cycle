# Counter

The simplest possible effect-cycle application. A counter with increment and decrement buttons that shows how the core driver cycle works: read user interactions from `DOMSource`, maintain local state in a `Ref`, and push a stream of rendered HTML to `DOMSink`. No reducers, no framework lifecycle, just an Effect.

## Getting started

```sh
pnpm dev
```

The dev server starts at `http://localhost:5173` (or the next available port).

## What it demonstrates

- The fundamental effect-cycle pattern: yield a source, yield a sink, render a stream
- `DOMSource.select(selector, event)` for reading browser events as streams
- `Ref` for concurrent-safe local mutable state
- `Stream.mergeAll` for fan-in of multiple event streams
- `DOMSink.render` for writing a stream of HTML strings to the DOM
- `makeHotRuntime` and HMR disposal for Vite hot-module replacement
- Wiring a driver layer with `Layer.provide` and `DOMConfigDefault`

## Key files

| File | Description |
|------|-------------|
| `src/App.ts` | The entire application -- event selection, state updates, and the render stream |
| `src/main.ts` | Layer composition, `makeHotRuntime` setup, and HMR integration |
