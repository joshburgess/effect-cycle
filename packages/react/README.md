# effect-cycle-react

[React](https://react.dev)-backed `DOMSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle). Renders a `Stream<ReactElement>` into a root via `react-dom/client`.

## Install

```sh
pnpm add effect-cycle-react effect-cycle-dom effect-cycle-core effect react react-dom
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { createElement as h } from "react"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive, DOMSink } from "effect-cycle-react"
import { run } from "effect-cycle-core"

const app = Effect.gen(function* () {
  const sink = yield* DOMSink
  const view$ = Stream.tick("1 second").pipe(
    Stream.scan(0, (n) => n + 1),
    Stream.map((n) => h("div", null, `tick ${n}`)),
  )
  yield* sink.render(view$)
})

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

`isolate(component, "ns")` scopes a sub-component into a `data-ns="ns"` subtree.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
