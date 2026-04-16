import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Context } from "effect"
import type { Effect, Stream } from "effect"

/**
 * Write-only HTTP sink service.
 *
 * Accepts streams of HTTP requests grouped by category. Each request
 * is executed by the underlying `HttpClient` and the response is
 * routed to `HTTPSource.response(category)`.
 *
 * @since 0.1.0
 */
export class HTTPSink extends Context.Tag("effect-cycle/HTTPSink")<
  HTTPSink,
  {
    /**
     * Dispatches a stream of HTTP requests under the given category.
     * Responses become available on `HTTPSource.response(category)`.
     *
     * @param category - A string key to correlate these requests with their responses.
     * @param req$ - A stream of `HttpClientRequest` values to send.
     */
    readonly request: (
      category: string,
      req$: Stream.Stream<HttpClientRequest.HttpClientRequest>,
    ) => Effect.Effect<void>
  }
>() {}
