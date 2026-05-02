import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Context } from "effect"
import type { Stream } from "effect"
import type { HTTPError } from "./errors.js"

/**
 * Read-only HTTP source service.
 *
 * Provides streams of HTTP responses grouped by category. Responses
 * are routed here by the HTTP driver when requests are sent via `HTTPSink`.
 *
 * @since 0.1.0
 */
export class HTTPSource extends Context.Tag("effect-cycle/HTTPSource")<
  HTTPSource,
  {
    /**
     * Returns a stream of successful HTTP responses for the given category.
     *
     * Failures are NOT emitted on this stream; subscribe to `errors(category)`
     * to observe them.
     *
     * @param category - A string key that correlates requests to responses.
     */
    readonly response: (category: string) => Stream.Stream<HttpClientResponse.HttpClientResponse>

    /**
     * Returns a stream of HTTP failures for the given category. The driver
     * also logs each failure at warning level via `Effect.logWarning`.
     *
     * @param category - A string key that correlates requests to responses.
     */
    readonly errors: (category: string) => Stream.Stream<HTTPError>
  }
>() {}
