import { Chunk, type Context, Effect, Layer, Ref, Stream } from "effect"

/**
 * Service shape required of any renderer's DOMSink Tag.
 *
 * Each renderer (`effect-cycle-morphdom`, `effect-cycle-tachys`, ...) ships
 * its own `DOMSink` Tag with the same shape but a different `VNode` type.
 */
type DOMSinkService<V> = {
  readonly render: (vdom$: Stream.Stream<V>) => Effect.Effect<void>
}

/**
 * Creates a test `DOMSink` layer for a specific renderer's `DOMSink` Tag.
 *
 * Captures all rendered VNodes into a `Ref` for assertion. The renderer's
 * `DOMSink` Tag is passed in so the same factory works for any renderer
 * (morphdom, tachys, ...).
 *
 * @example
 * ```ts
 * import { DOMSink } from "effect-cycle-morphdom"
 * const { layer, rendered } = yield* TestDOMSink(DOMSink)
 * ```
 *
 * @since 0.1.0
 */
export const TestDOMSink = <Id, V>(
  tag: Context.Tag<Id, DOMSinkService<V>>,
): Effect.Effect<{
  readonly layer: Layer.Layer<Id>
  readonly rendered: Ref.Ref<Chunk.Chunk<V>>
}> =>
  Effect.gen(function* () {
    const rendered = yield* Ref.make(Chunk.empty<V>())
    const layer = Layer.succeed(tag, {
      render: (vdom$: Stream.Stream<V>) =>
        Stream.runForEach(vdom$, (v) => Ref.update(rendered, Chunk.append(v))),
    })
    return { layer, rendered } as const
  })
