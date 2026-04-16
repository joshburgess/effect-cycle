import { Effect, Layer, Stream } from "effect"
import { WSSource } from "effect-cycle-ws"

/**
 * Creates a test `WSSource` layer that replays scripted message events.
 *
 * The `connected` effect resolves immediately (always succeeds).
 *
 * @param events - An array of `MessageEvent` values to emit.
 * @returns A `Layer` providing `WSSource` with the scripted events.
 *
 * @since 0.1.0
 */
export const TestWSSource = (events: ReadonlyArray<MessageEvent>): Layer.Layer<WSSource> =>
  Layer.succeed(WSSource, {
    messages: Stream.fromIterable(events),
    connected: Effect.void,
  })
