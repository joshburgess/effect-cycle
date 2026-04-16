import { Context } from "effect"

/**
 * Configuration for the WebSocket driver.
 *
 * @since 0.1.0
 */
export class WSConfig extends Context.Tag("effect-cycle/WSConfig")<
  WSConfig,
  {
    /** The WebSocket URL to connect to (e.g. `"ws://localhost:8080"`). */
    readonly url: string
    /** Optional sub-protocols to request during the handshake. */
    readonly protocols?: ReadonlyArray<string>
  }
>() {}
