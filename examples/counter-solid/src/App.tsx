/**
 * Counter (Solid) example: the same counter app as `examples/counter`,
 * but rendered through `effect-cycle-solid` instead of `effect-cycle-tachys`.
 *
 * Unlike the VDOM-style counters (tachys/morphdom/preact/react/lit-html/vue)
 * that push a `Stream<VNode>` through `DOMSink`, the Solid renderer mounts
 * the component once and bridges Effect `Stream`s to Solid `Accessor`s for
 * fine-grained reactivity:
 *
 *   - `ReactiveSink.fromStream(stream, initial)` bridges a `Stream<A>` into
 *     a Solid signal seeded with `initial`. The accessor is read inside the
 *     component, and Solid wires up a per-text-node update path.
 *   - `ReactiveSink.render(component)` mounts the component once. Subsequent
 *     stream emissions update only the text nodes that read the signal.
 *
 * `DOMSource` and the rest (Ref, Stream wiring) are identical.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { ReactiveSink } from "effect-cycle-solid"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* ReactiveSink

  const ref = yield* Ref.make(0)

  const inc$ = dom
    .select(".increment", "click")
    .pipe(Stream.tap(() => Ref.update(ref, (n) => n + 1)))

  const dec$ = dom
    .select(".decrement", "click")
    .pipe(Stream.tap(() => Ref.update(ref, (n) => n - 1)))

  const count$ = Stream.mergeAll([inc$, dec$], { concurrency: 2 }).pipe(
    Stream.mapEffect(() => Ref.get(ref)),
  )

  // Bridge the Effect Stream into a Solid Accessor seeded with 0.
  // The accessor read inside the component below tracks fine-grained updates.
  const count = yield* sink.fromStream(count$, 0)

  // Mount the component once. Solid runs this exactly one time at mount and
  // wires up per-signal-read DOM updates for everything inside.
  yield* sink.render(() => (
    <div>
      <h1>Count: {count()}</h1>
      <button class="decrement" type="button">
        -
      </button>
      <button class="increment" type="button">
        +
      </button>
    </div>
  ))
})

export default app
