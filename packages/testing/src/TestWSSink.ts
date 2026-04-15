import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { WSSink } from "effect-cycle-ws"

export const TestWSSink = (): Effect.Effect<{
  readonly layer: Layer.Layer<WSSink>
  readonly captured: Ref.Ref<Chunk.Chunk<string | ArrayBuffer>>
}> =>
  Effect.gen(function* () {
    const captured = yield* Ref.make(Chunk.empty<string | ArrayBuffer>())
    const layer = Layer.succeed(WSSink, {
      send: (msg$: Stream.Stream<string | ArrayBuffer>) =>
        Stream.runForEach(msg$, (msg) => Ref.update(captured, Chunk.append(msg))),
    })
    return { layer, captured } as const
  })
