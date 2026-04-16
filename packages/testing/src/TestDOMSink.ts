import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { DOMSink } from "effect-cycle-dom"
import type { VNode } from "effect-cycle-dom"

/**
 * Creates a test `DOMSink` that captures all rendered VNodes into a `Ref`.
 *
 * Returns an Effect that provides both the layer and the `rendered` Ref
 * for assertion.
 *
 * @since 0.1.0
 */
export const TestDOMSink = (): Effect.Effect<{
  readonly layer: Layer.Layer<DOMSink>
  readonly rendered: Ref.Ref<Chunk.Chunk<VNode>>
}> =>
  Effect.gen(function* () {
    const rendered = yield* Ref.make(Chunk.empty<VNode>())
    const layer = Layer.succeed(DOMSink, {
      render: (vdom$: Stream.Stream<VNode>) =>
        Stream.runForEach(vdom$, (v) => Ref.update(rendered, Chunk.append(v))),
    })
    return { layer, rendered } as const
  })
