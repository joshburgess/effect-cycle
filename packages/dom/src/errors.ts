import { Data } from "effect"

/**
 * Error raised by the DOM driver when a required element cannot be found.
 *
 * @since 0.0.1
 */
export class DOMError extends Data.TaggedError("DOMError")<{
  /** The CSS selector that failed to match. */
  readonly selector: string
  /** Human-readable description of the error. */
  readonly message: string
}> {}
