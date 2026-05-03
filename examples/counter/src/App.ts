/**
 * Counter example: the simplest possible effect-cycle app.
 *
 * This demonstrates the core pattern:
 *   1. Yield DOMSource to read user interactions as streams
 *   2. Maintain local state in a Ref
 *   3. Yield DOMSink to push a stream of VNodes for rendering
 *
 * Uses the tachys vDOM renderer (`effect-cycle-tachys`): `DOMSource` comes
 * from `effect-cycle-dom`, while the renderer-specific `DOMSink` (and the
 * `DOMDriverLive` wired up in main.ts) come from `effect-cycle-tachys`.
 *
 * No drivers are constructed here; they are provided externally by `run()`.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink, type VNode } from "effect-cycle-tachys"
import { h } from "tachys/sync"

// The app is just an Effect: no class, no framework lifecycle hooks.
// effect-cycle's `run()` will provide DOMSource and DOMSink from the driver layer.
const app = Effect.gen(function* () {
  // DOMSource is a service tag; yielding it retrieves the driver-provided implementation.
  // The driver scopes all selectors to the root element configured in DOMConfig.
  const dom = yield* DOMSource

  // DOMSink receives a stream of tachys VNodes and renders each emission into the root.
  const sink = yield* DOMSink

  // Local mutable state: Effect's Ref is a pure, concurrent-safe cell.
  const count = yield* Ref.make(0)

  // dom.select returns a Stream<Event> that emits every time a matching element is clicked.
  // Stream.tap lets us run a side effect (updating the Ref) for each emission,
  // passing the event downstream unchanged.
  const inc$ = dom
    .select(".increment", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n + 1)))

  const dec$ = dom
    .select(".decrement", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n - 1)))

  // Stream.mergeAll fans-in both event streams into one.
  // After each interaction we read the current count and map it to a VNode tree.
  const vdom$: Stream.Stream<VNode> = Stream.mergeAll([inc$, dec$], { concurrency: 2 }).pipe(
    // After each click, read the latest count value from the Ref.
    Stream.mapEffect(() => Ref.get(count)),
    // Produce a VNode reflecting current state.
    Stream.map((n) =>
      h(
        "div",
        null,
        h("h1", null, `Count: ${n}`),
        h("button", { className: "decrement" }, "-"),
        h("button", { className: "increment" }, "+"),
      ),
    ),
  )

  // Handing the vdom$ stream to the sink starts the render loop.
  // The sink subscribes to vdom$ and patches the DOM on each emission.
  yield* sink.render(vdom$)
})

export default app
