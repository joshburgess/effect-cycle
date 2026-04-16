import { Context, type Effect, type Stream } from "effect"
import type { WSError } from "./errors.js"

/**
 * Read-only WebSocket source service.
 *
 * Provides a stream of incoming messages and an effect to await
 * the connection handshake.
 *
 * @since 0.1.0
 */
export class WSSource extends Context.Tag("effect-cycle/WSSource")<
  WSSource,
  {
    /** Stream of incoming `MessageEvent` values. Fails with `WSError` on disconnect. */
    readonly messages: Stream.Stream<MessageEvent, WSError>
    /** Resolves when the WebSocket connection is open. Fails with `WSError` if it cannot connect. */
    readonly connected: Effect.Effect<void, WSError>
  }
>() {}
