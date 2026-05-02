import * as HttpClient from "@effect/platform/HttpClient"
import type * as HttpClientError from "@effect/platform/HttpClientError"
import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { createAdapter, filter, map } from "aeon-core"
import { toStream } from "aeon-effect"
import { DefaultScheduler } from "aeon-scheduler"
import { Context, Effect, Layer, Stream } from "effect"
import { HTTPSink } from "./HTTPSink.js"
import { HTTPSource } from "./HTTPSource.js"
import { HTTPError } from "./errors.js"

/**
 * Live implementation of the HTTP driver.
 *
 * Routes requests from `HTTPSink` through `HttpClient` and publishes
 * responses to `HTTPSource`, correlated by category string.
 *
 * Requires `HttpClient.HttpClient` from `@effect/platform`.
 *
 * @since 0.1.0
 */
export const HTTPDriverLive: Layer.Layer<HTTPSource | HTTPSink, never, HttpClient.HttpClient> =
  Layer.scopedContext(
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient
      const scope = yield* Effect.scope

      const scheduler = yield* Effect.sync(() => new DefaultScheduler())
      const [push, responseEvent] = yield* Effect.sync(() =>
        createAdapter<{
          category: string
          response: HttpClientResponse.HttpClientResponse
        }>(),
      )

      const [pushError, errorEvent] = yield* Effect.sync(() =>
        createAdapter<{ category: string; error: HTTPError }>(),
      )

      const source: HTTPSource["Type"] = {
        response: (category) => {
          const filtered = filter((msg) => msg.category === category, responseEvent)
          const mapped = map((msg) => msg.response, filtered)
          return toStream(mapped, scheduler)
        },
        errors: (category) => {
          const filtered = filter((msg) => msg.category === category, errorEvent)
          const mapped = map((msg) => msg.error, filtered)
          return toStream(mapped, scheduler)
        },
      }

      const toHTTPError = (err: HttpClientError.HttpClientError, url: string): HTTPError => {
        if (
          err._tag === "RequestError" &&
          typeof err.description === "string" &&
          err.description.includes("timed out")
        ) {
          return new HTTPError({ status: 408, body: err.description, url })
        }
        const status = err._tag === "ResponseError" ? err.response.status : 0
        return new HTTPError({ status, body: err.message, url })
      }

      const sink: HTTPSink["Type"] = {
        request: (category, req$) =>
          Stream.runForEach(req$, (request) =>
            httpClient.execute(request).pipe(
              Effect.mapError((err) => toHTTPError(err, request.url)),
              Effect.scoped,
              Effect.tap((response) => Effect.sync(() => push({ category, response }))),
              Effect.tapError((error) =>
                Effect.sync(() => pushError({ category, error })).pipe(
                  Effect.zipRight(
                    Effect.logWarning("HTTP request failed").pipe(
                      Effect.annotateLogs({
                        category,
                        url: request.url,
                        status: error.status,
                      }),
                    ),
                  ),
                ),
              ),
              Effect.ignore,
            ),
          ).pipe(Effect.forkIn(scope), Effect.asVoid),
      }

      return Context.empty().pipe(Context.add(HTTPSource, source), Context.add(HTTPSink, sink))
    }).pipe(Effect.withSpan("HTTPDriverLive.acquire")),
  )
