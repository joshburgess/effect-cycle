import { Effect, Layer, Stream } from "effect"
import { WSSink } from "effect-cycle-ws"

export const TestWSSink = () => {
  const captured: Array<string | ArrayBuffer> = []
  const layer = Layer.succeed(WSSink, {
    send: (msg$: Stream.Stream<string | ArrayBuffer>) =>
      Stream.runForEach(msg$, (msg) =>
        Effect.sync(() => {
          captured.push(msg)
        }),
      ),
  })
  return { layer, captured } as const
}
