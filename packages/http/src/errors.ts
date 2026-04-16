import { Data } from "effect"

/**
 * Error raised by the HTTP driver on request failure.
 *
 * @since 0.1.0
 */
export class HTTPError extends Data.TaggedError("HTTPError")<{
  /** HTTP status code (0 for network errors). */
  readonly status: number
  /** Error message or response body. */
  readonly body: string
  /** The request URL that failed. */
  readonly url: string
}> {}
