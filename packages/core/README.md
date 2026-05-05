# effect-cycle-core

Core runtime, HMR helper, isolation primitives, and shared metrics for [effect-cycle](https://github.com/joshburgess/effect-cycle), a reimagining of Cycle.js on top of Effect 3.x primitives.

## Install

```sh
pnpm add effect-cycle-core effect
```

## What's in the box

- `run`, `makeManagedRuntime`, `makeHotRuntime`, `installHmr` — start, stop, and hot-reload an effect-cycle app over a `ManagedRuntime`.
- `instrumentService` — wrap a `Context.Tag` service's methods (used by `effect-cycle-devtools`).
- `domEventCount`, `httpRequestCount`, `httpErrorCount`, `wsMessageCount`, `wsSendCount`, `domRenderCount`, `routerNavCount` — shared `Metric.counter`s.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
