import { Data } from "effect"

/**
 * Error raised by the HTTP driver on request failure.
 *
 * Timeouts surface as `HTTPError` with `status: 408` so callers can
 * distinguish them from other transport errors without a separate tag.
 *
 * @since 0.1.0
 */
export class HTTPError extends Data.TaggedError("HTTPError")<{
  /** HTTP status code. 0 for transport errors, 408 for timeouts. */
  readonly status: number
  /** Error message or response body. */
  readonly body: string
  /** The request URL that failed. */
  readonly url: string
}> {}
