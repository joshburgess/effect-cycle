import { Data } from "effect"

/**
 * Error raised when a driver fails to initialize.
 *
 * Typically surfaced during `Layer` construction when the underlying
 * resource (DOM element, WebSocket connection, etc.) cannot be acquired.
 *
 * @since 0.0.1
 */
export class DriverInitError extends Data.TaggedError("DriverInitError")<{
  /** The driver name (e.g. "DOMDriver", "WSDriver"). */
  readonly driver: string
  /** The underlying cause of the initialization failure. */
  readonly cause: unknown
}> {}
