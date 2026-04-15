import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Layer, Stream } from "effect"
import { HTTPSource } from "effect-cycle-http"

export const TestHTTPSource = (
  responses: Record<string, ReadonlyArray<HttpClientResponse.HttpClientResponse>>,
): Layer.Layer<HTTPSource> =>
  Layer.succeed(HTTPSource, {
    response: (category: string) => Stream.fromIterable(responses[category] ?? []),
  })
