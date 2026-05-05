# effect-cycle-morphdom

[morphdom](https://github.com/patrick-steele-idem/morphdom)-backed `DOMSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle). Renders a `Stream<HTMLElement>` into a root by diffing against the live DOM — no virtual DOM library required.

## Install

```sh
pnpm add effect-cycle-morphdom effect-cycle-dom effect-cycle-core effect morphdom
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive, DOMSink } from "effect-cycle-morphdom"
import { run } from "effect-cycle-core"

const app = Effect.gen(function* () {
  const sink = yield* DOMSink
  const tick$ = Stream.tick("1 second").pipe(
    Stream.scan(0, (n) => n + 1),
    Stream.map((n) => {
      const el = document.createElement("div")
      el.textContent = `tick ${n}`
      return el
    }),
  )
  yield* sink.render(tick$)
})

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
