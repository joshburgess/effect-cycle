/**
 * Counter (React) example: the same counter app as `examples/counter`,
 * but rendered through `effect-cycle-react` instead of `effect-cycle-tachys`.
 *
 * The application code is renderer-agnostic apart from:
 *   - `DOMSink` and `VNode` come from `effect-cycle-react`
 *   - `h` is `React.createElement`, imported from `react`
 *
 * Everything else (DOMSource, Ref, Stream wiring) is identical.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink, type VNode } from "effect-cycle-react"
import { createElement as h } from "react"

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
    Stream.map((n) =>
      h(
        "div",
        null,
        h("h1", null, `Count: ${n}`),
        h("button", { type: "button", className: "decrement" }, "-"),
        h("button", { type: "button", className: "increment" }, "+"),
      ),
    ),
  )

  yield* sink.render(vdom$)
})

export default app
