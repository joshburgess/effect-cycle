import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Cause, Config, Duration, Effect, Layer, Schedule } from "effect"
import { HTTPDriverLive } from "./HTTPDriver.js"
import type { HTTPSink } from "./HTTPSink.js"
import type { HTTPSource } from "./HTTPSource.js"

/**
 * Config values that the HTTP driver can read from the environment.
 * All have sensible defaults so the driver works zero-config.
 */
export const HTTPConfig = {
  /** Base URL prepended to all request URLs. Default: "" (no prefix) */
  baseUrl: Config.string("HTTP_BASE_URL").pipe(Config.withDefault("")),
  /** Request timeout in milliseconds. Default: 30000 */
  timeout: Config.number("HTTP_TIMEOUT_MS").pipe(Config.withDefault(30000)),
  /** Max retry attempts on failure. Default: 0 (no retries) */
  retries: Config.number("HTTP_RETRIES").pipe(Config.withDefault(0)),
}

/**
 * A variant of HTTPDriverLive that reads HTTPConfig values and applies them
 * to the HttpClient before providing it to HTTPDriverLive.
 *
 * Requires HttpClient.HttpClient (the raw client) and provides HTTPSource | HTTPSink
 * with the config applied.
 */
export const HTTPDriverConfigured: Layer.Layer<
  HTTPSource | HTTPSink,
  never,
  HttpClient.HttpClient
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const baseUrl = yield* HTTPConfig.baseUrl
    const timeoutMs = yield* HTTPConfig.timeout
    const retries = yield* HTTPConfig.retries

    const configuredClientLayer = Layer.effect(
      HttpClient.HttpClient,
      Effect.map(HttpClient.HttpClient, (client) => {
        let configured: HttpClient.HttpClient = client

        if (baseUrl !== "") {
          configured = HttpClient.mapRequest(configured, HttpClientRequest.prependUrl(baseUrl))
        }

        // Apply timeout: use timeoutFailCause with Cause.die so the error channel type
        // stays as HttpClientError (timeout becomes a defect instead of a typed error).
        configured = HttpClient.transformResponse(configured, (effect) =>
          Effect.timeoutFailCause(effect, {
            duration: Duration.millis(timeoutMs),
            onTimeout: () => Cause.die(new Error(`Request timed out after ${timeoutMs}ms`)),
          }),
        )

        if (retries > 0) {
          configured = HttpClient.retry(configured, Schedule.recurs(retries))
        }

        return configured
      }),
    )

    return HTTPDriverLive.pipe(Layer.provide(configuredClientLayer))
  }).pipe(Effect.orDie),
)
