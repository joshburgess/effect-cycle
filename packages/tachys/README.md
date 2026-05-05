# effect-cycle-tachys

[tachys](https://github.com/leptos-rs/tachys)-backed `DOMSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle), in tachys's synchronous mode.

## Install

```sh
pnpm add effect-cycle-tachys effect-cycle-dom effect-cycle-core effect tachys
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive, DOMSink } from "effect-cycle-tachys"
import { run } from "effect-cycle-core"

const app = Effect.gen(function* () {
  const sink = yield* DOMSink
  const view$ = Stream.tick("1 second").pipe(
    Stream.scan(0, (n) => n + 1),
    Stream.map((n) => tachysView(n)),
  )
  yield* sink.render(view$)
})

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

`isolate(component, "ns")` scopes a sub-component into a `data-ns="ns"` subtree.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
