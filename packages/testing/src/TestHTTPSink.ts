import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { HTTPSink } from "effect-cycle-http"

export interface CapturedRequest {
  readonly category: string
  readonly request: HttpClientRequest.HttpClientRequest
}

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
