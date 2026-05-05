import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { WSSink } from "effect-cycle-ws"

/**
 * Creates a test `WSSink` that captures all sent messages into a `Ref`.
 *
 * Returns an Effect that provides both the layer and the `captured` Ref
 * for assertion. Like the production `WSSink`, `send` forks the
 * subscription so it returns immediately. Callers asserting on `captured`
 * must wait for the fork to drain (e.g. poll the `Ref` or yield enough
 * scheduling steps) instead of relying on `send` to block.
 *
 * @since 0.1.0
 */
export const TestWSSink = (): Effect.Effect<{
  readonly layer: Layer.Layer<WSSink>
  readonly captured: Ref.Ref<Chunk.Chunk<string | ArrayBuffer>>
}> =>
  Effect.gen(function* () {
    const captured = yield* Ref.make(Chunk.empty<string | ArrayBuffer>())
    const layer = Layer.succeed(WSSink, {
      send: (msg$: Stream.Stream<string | ArrayBuffer>) =>
        Stream.runForEach(msg$, (msg) => Ref.update(captured, Chunk.append(msg))).pipe(
          Effect.fork,
          Effect.asVoid,
        ),
    })
    return { layer, captured } as const
  })
