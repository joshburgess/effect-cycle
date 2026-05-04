/**
 * Counter (Svelte) example: the same counter app as `examples/counter`,
 * but rendered through `effect-cycle-svelte` instead of `effect-cycle-tachys`.
 *
 * Like the Solid example, this demonstrates the `ReactiveSink` contract
 * rather than the VDOM-style `DOMSink`:
 *
 *   - `ReactiveSink.fromStream(stream, initial)` bridges the merged event
 *     stream into a Svelte `Readable<number>` store, seeded with 0.
 *   - `ReactiveSink.mount(Component, props)` mounts the component once.
 *     The `Counter.svelte` template subscribes to the `count` prop via the
 *     `$count` shorthand, so subsequent stream emissions update only the
 *     interpolated text node.
 *
 * `DOMSource`, `Ref`, and the merged event streams are identical to the
 * other counter examples.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { ReactiveSink } from "effect-cycle-svelte"
import Counter from "./Counter.svelte"

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

  // Bridge the Effect Stream into a Svelte Readable store seeded with 0.
  const count = yield* sink.fromStream(count$, 0)

  // Mount the Svelte component once. The component reads `$count` and
  // wires up its own fine-grained DOM updates per Svelte's compiler.
  yield* sink.mount(Counter, { count })
})

export default app
