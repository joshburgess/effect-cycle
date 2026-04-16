import { Data } from "effect"

/**
 * Error raised by the router driver.
 *
 * @since 0.1.0
 */
export class RouterError extends Data.TaggedError("RouterError")<{
  /** Human-readable description of the routing error. */
  readonly message: string
}> {}
