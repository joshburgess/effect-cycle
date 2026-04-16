import { Context, type Effect, type Stream } from "effect"

/**
 * Write-only WebSocket sink service.
 *
 * Accepts a stream of outgoing messages and writes each one to the socket.
 *
 * @since 0.0.1
 */
export class WSSink extends Context.Tag("effect-cycle/WSSink")<
  WSSink,
  {
    /**
     * Subscribes to the given stream and sends each value through the WebSocket.
     *
     * @param msg$ - A stream of string or binary messages to send.
     */
    readonly send: (msg$: Stream.Stream<string | ArrayBuffer>) => Effect.Effect<void>
  }
>() {}
