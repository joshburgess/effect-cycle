import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Layer, Stream } from "effect"
import { HTTPSource } from "effect-cycle-http"

/**
 * Creates a test `HTTPSource` layer that replays scripted responses.
 *
 * @param responses - A record mapping category strings to arrays of responses.
 * @returns A `Layer` providing `HTTPSource` with the scripted responses.
 *
 * @since 0.0.1
 */
export const TestHTTPSource = (
  responses: Record<string, ReadonlyArray<HttpClientResponse.HttpClientResponse>>,
): Layer.Layer<HTTPSource> =>
  Layer.succeed(HTTPSource, {
    response: (category: string) => Stream.fromIterable(responses[category] ?? []),
  })
