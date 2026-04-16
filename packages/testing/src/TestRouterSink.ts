import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import type { Navigation } from "effect-cycle-router"
import { RouterSink } from "effect-cycle-router"

/**
 * Creates a test `RouterSink` that captures all navigation commands into a `Ref`.
 *
 * Returns an Effect that provides both the layer and the `captured` Ref
 * for assertion. Each `push`, `replace`, or `navigate` stream element is
 * recorded as a `Navigation` value.
 *
 * @since 0.1.0
 */
export const TestRouterSink = (): Effect.Effect<{
  readonly layer: Layer.Layer<RouterSink>
  readonly captured: Ref.Ref<Chunk.Chunk<Navigation>>
}> =>
  Effect.gen(function* () {
    const captured = yield* Ref.make(Chunk.empty<Navigation>())

    const record = (nav: Navigation) => Ref.update(captured, Chunk.append(nav))

    const layer = Layer.succeed(RouterSink, {
      navigate: (nav$: Stream.Stream<Navigation>) => Stream.runForEach(nav$, record),

      push: (path: string) => record({ type: "push", path }),

      replace: (path: string) => record({ type: "replace", path }),
    })

    return { layer, captured } as const
  })
