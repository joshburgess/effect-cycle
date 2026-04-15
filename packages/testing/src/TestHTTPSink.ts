import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Effect, Layer, Stream } from "effect"
import { HTTPSink } from "effect-cycle-http"

export const TestHTTPSink = () => {
  const captured: Array<{ category: string; request: HttpClientRequest.HttpClientRequest }> = []
  const layer = Layer.succeed(HTTPSink, {
    request: (category: string, req$: Stream.Stream<HttpClientRequest.HttpClientRequest>) =>
      Stream.runForEach(req$, (request) =>
        Effect.sync(() => {
          captured.push({ category, request })
        }),
      ),
  })
  return { layer, captured } as const
}
