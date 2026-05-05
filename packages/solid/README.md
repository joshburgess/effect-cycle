# effect-cycle-solid

[Solid](https://www.solidjs.com)-backed `ReactiveSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle). Mounts a Solid component **once** and bridges Effect Streams to Solid signals — this preserves Solid's compile-time-tracked update paths instead of diffing whole trees.

## Install

```sh
pnpm add effect-cycle-solid effect-cycle-dom effect-cycle-core effect solid-js
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { createMemo } from "solid-js"
import { DOMConfigDefault } from "effect-cycle-dom"
import { ReactiveDriverLive, ReactiveSink } from "effect-cycle-solid"
import { run } from "effect-cycle-core"

const app = Effect.gen(function* () {
  const sink = yield* ReactiveSink

  const tick$ = Stream.tick("1 second").pipe(Stream.scan(0, (n) => n + 1))
  const count = yield* sink.fromStream(tick$, 0)

  yield* sink.render(() => <div>tick {count()}</div>)
})

run(app, ReactiveDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

`fromStream` returns a Solid `Accessor`. `render` mounts your component once.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
