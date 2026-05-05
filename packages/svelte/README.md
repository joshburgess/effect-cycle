# effect-cycle-svelte

[Svelte](https://svelte.dev)-backed `ReactiveSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle). Mounts a Svelte component **once** and bridges Effect Streams to Svelte stores — this preserves Svelte's compile-time-tracked update paths instead of diffing whole trees.

## Install

```sh
pnpm add effect-cycle-svelte effect-cycle-dom effect-cycle-core effect svelte
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { DOMConfigDefault } from "effect-cycle-dom"
import { ReactiveDriverLive, ReactiveSink } from "effect-cycle-svelte"
import { run } from "effect-cycle-core"
import App from "./App.svelte"

const app = Effect.gen(function* () {
  const sink = yield* ReactiveSink

  const tick$ = Stream.tick("1 second").pipe(Stream.scan(0, (n) => n + 1))
  const count = yield* sink.fromStream(tick$, 0)

  yield* sink.render(App, { count })
})

run(app, ReactiveDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

`fromStream` returns a Svelte `Readable`. `render` mounts your component once with props.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
