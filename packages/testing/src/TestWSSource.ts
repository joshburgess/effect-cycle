import { Effect, Layer, Stream } from "effect"
import { WSSource } from "effect-cycle-ws"

export const TestWSSource = (events: ReadonlyArray<MessageEvent>): Layer.Layer<WSSource> =>
  Layer.succeed(WSSource, {
    messages: Stream.fromIterable(events),
    connected: Effect.void,
  })
