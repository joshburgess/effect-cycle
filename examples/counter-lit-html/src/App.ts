/**
 * Counter (lit-html) example: the same counter app as `examples/counter`,
 * but rendered through `effect-cycle-lit-html` instead of `effect-cycle-tachys`.
 *
 * The application code is renderer-agnostic apart from:
 *   - `DOMSink` and `VNode` come from `effect-cycle-lit-html`
 *   - The view is built with lit-html's `html` tagged template instead of `h(...)`
 *
 * Everything else (DOMSource, Ref, Stream wiring) is identical.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink, type VNode } from "effect-cycle-lit-html"
import { html } from "lit-html"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink

  const count = yield* Ref.make(0)

  const inc$ = dom
    .select(".increment", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n + 1)))

  const dec$ = dom
    .select(".decrement", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n - 1)))

  const vdom$: Stream.Stream<VNode> = Stream.mergeAll([inc$, dec$], { concurrency: 2 }).pipe(
    Stream.mapEffect(() => Ref.get(count)),
    Stream.map(
      (n) => html`
        <div>
          <h1>Count: ${n}</h1>
          <button class="decrement" type="button">-</button>
          <button class="increment" type="button">+</button>
        </div>
      `,
    ),
  )

  yield* sink.render(vdom$)
})

export default app
