# effect-cycle-lit-html

[lit-html](https://lit.dev/docs/libraries/standalone-templates/)-backed `DOMSink` for [effect-cycle](https://github.com/joshburgess/effect-cycle). Renders a `Stream<TemplateResult>` into a root.

## Install

```sh
pnpm add effect-cycle-lit-html effect-cycle-dom effect-cycle-core effect lit-html
```

## Usage

```ts
import { Effect, Layer, Stream } from "effect"
import { html } from "lit-html"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive, DOMSink } from "effect-cycle-lit-html"
import { run } from "effect-cycle-core"

const app = Effect.gen(function* () {
  const sink = yield* DOMSink
  const view$ = Stream.tick("1 second").pipe(
    Stream.scan(0, (n) => n + 1),
    Stream.map((n) => html`<div>tick ${n}</div>`),
  )
  yield* sink.render(view$)
})

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

`isolate(component, "ns")` scopes a sub-component into a `data-ns="ns"` subtree.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
