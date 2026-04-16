import { Data } from "effect"

/**
 * Error raised by the WebSocket driver on connection failure or disconnect.
 *
 * @since 0.0.1
 */
export class WSError extends Data.TaggedError("WSError")<{
  /** The WebSocket URL that failed. */
  readonly url: string
  /** WebSocket close code, if available. */
  readonly code?: number
  /** WebSocket close reason, if available. */
  readonly reason?: string
}> {}
