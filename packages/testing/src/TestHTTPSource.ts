import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Layer, Stream } from "effect"
import { type HTTPError, HTTPSource } from "effect-cycle-http"

/**
 * Creates a test `HTTPSource` layer that replays scripted responses.
 *
 * @param responses - A record mapping category strings to arrays of responses.
 * @param errors - Optional record mapping category strings to arrays of errors.
 * @returns A `Layer` providing `HTTPSource` with the scripted responses.
 *
 * @since 0.1.0
 */
export const TestHTTPSource = (
  responses: Record<string, ReadonlyArray<HttpClientResponse.HttpClientResponse>>,
  errors: Record<string, ReadonlyArray<HTTPError>> = {},
): Layer.Layer<HTTPSource> =>
  Layer.succeed(HTTPSource, {
    response: (category: string) => Stream.fromIterable(responses[category] ?? []),
    errors: (category: string) => Stream.fromIterable(errors[category] ?? []),
  })
