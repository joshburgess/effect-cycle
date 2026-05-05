# effect-cycle-dom

Renderer-agnostic `DOMSource` Tag and shared DOM helpers for [effect-cycle](https://github.com/joshburgess/effect-cycle).

This package owns the DOM event-capture contract. Renderer packages (`effect-cycle-morphdom`, `-preact`, `-react`, `-vue`, `-lit-html`, `-tachys`, `-solid`, `-svelte`) provide their own `DOMSink` Tag against this `DOMSource`.

## Install

```sh
pnpm add effect-cycle-dom effect-cycle-core effect
```

## Usage

```ts
import { Effect, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const clicks$ = dom.select(".btn", "click")
  yield* Stream.runForEach(clicks$, (e) => Effect.log(`clicked ${e.target}`))
})
```

The `DOMSource` Tag also exposes `element: Effect.Effect<Element, DOMError>` for the root element, plus `validatedEvent(...)` for `Schema`-validated event payloads.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
