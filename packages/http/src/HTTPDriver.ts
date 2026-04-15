import * as HttpClient from "@effect/platform/HttpClient"
import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Context, Effect, Layer, PubSub, Stream } from "effect"
import { HTTPSink } from "./HTTPSink.js"
import { HTTPSource } from "./HTTPSource.js"
import { HTTPError } from "./errors.js"

export const HTTPDriverLive: Layer.Layer<HTTPSource | HTTPSink, never, HttpClient.HttpClient> =
  Layer.scopedContext(
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient
      const scope = yield* Effect.scope
      const pubsub = yield* PubSub.unbounded<{
        category: string
        response: HttpClientResponse.HttpClientResponse
      }>()

      yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub))

      const source: HTTPSource["Type"] = {
        response: (category) =>
          Stream.fromPubSub(pubsub).pipe(
            Stream.filter((msg) => msg.category === category),
            Stream.map((msg) => msg.response),
          ),
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
              yield* PubSub.publish(pubsub, { category, response })
            }).pipe(Effect.catchAll(() => Effect.void)),
          ).pipe(Effect.forkIn(scope), Effect.asVoid),
      }

      return Context.empty().pipe(Context.add(HTTPSource, source), Context.add(HTTPSink, sink))
    }),
  )
