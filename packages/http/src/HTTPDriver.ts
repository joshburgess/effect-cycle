import * as HttpClient from "@effect/platform/HttpClient"
import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { createAdapter, filter, map } from "aeon-core"
import { toStream } from "aeon-effect"
import { DefaultScheduler } from "aeon-scheduler"
import { Context, Effect, Layer, Stream } from "effect"
import { HTTPSink } from "./HTTPSink.js"
import { HTTPSource } from "./HTTPSource.js"
import { HTTPError } from "./errors.js"

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

      const source: HTTPSource["Type"] = {
        response: (category) => {
          const filtered = filter((msg) => msg.category === category, responseEvent)
          const mapped = map((msg) => msg.response, filtered)
          return toStream(mapped, scheduler)
        },
      }

      const sink: HTTPSink["Type"] = {
        request: (category, req$) =>
          Stream.runForEach(req$, (request) =>
            Effect.gen(function* () {
              const response = yield* httpClient.execute(request).pipe(
                Effect.mapError(
                  (err) =>
                    new HTTPError({
                      status: "response" in err ? err.response.status : 0,
                      body: err.message,
                      url: request.url,
                    }),
                ),
                Effect.scoped,
              )
              yield* Effect.sync(() => push({ category, response }))
            }).pipe(Effect.catchAll(() => Effect.void)),
          ).pipe(Effect.forkIn(scope), Effect.asVoid),
      }

      return Context.empty().pipe(Context.add(HTTPSource, source), Context.add(HTTPSink, sink))
    }),
  )
