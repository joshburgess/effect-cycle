import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { HTTPSink } from "effect-cycle-http"

/**
 * A captured HTTP request with its category.
 *
 * @since 0.1.0
 */
export interface CapturedRequest {
  readonly category: string
  readonly request: HttpClientRequest.HttpClientRequest
}

/**
 * Creates a test `HTTPSink` that captures all dispatched requests into a `Ref`.
 *
 * Returns an Effect that provides both the layer and the `captured` Ref
 * for assertion.
 *
 * @since 0.1.0
 */
export const TestHTTPSink = (): Effect.Effect<{
  readonly layer: Layer.Layer<HTTPSink>
  readonly captured: Ref.Ref<Chunk.Chunk<CapturedRequest>>
}> =>
  Effect.gen(function* () {
    const captured = yield* Ref.make(Chunk.empty<CapturedRequest>())
    const layer = Layer.succeed(HTTPSink, {
      request: (category: string, req$: Stream.Stream<HttpClientRequest.HttpClientRequest>) =>
        Stream.runForEach(req$, (request) =>
          Ref.update(captured, Chunk.append({ category, request })),
        ),
    })
    return { layer, captured } as const
  })
