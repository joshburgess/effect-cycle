import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { httpErrorCount, httpRequestCount, instrumentService } from "effect-cycle-core"
import { HTTPSink, HTTPSource } from "effect-cycle-http"
import { DevToolsConfig } from "./DevToolsConfig.js"

// -------------------------------------------------------------------------------------
// instrumentHTTPSource
// -------------------------------------------------------------------------------------

/**
 * Wraps `HTTPSource.response` and `HTTPSource.errors` with metrics, logging,
 * and span instrumentation.
 *
 * @since 0.1.0
 */
export const instrumentHTTPSource: Layer.Layer<HTTPSource, never, HTTPSource | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(HTTPSource, {
        response: (original) => (category) =>
          original(category).pipe(
            config.enableMetrics
              ? Stream.tap(() => Metric.increment(httpRequestCount))
              : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((res) =>
                  Effect.log(`[HTTPSource] response("${category}") status: ${res.status}`),
                )
              : F.identity,
            config.enableSpans ? Stream.withSpan("http.source.response") : F.identity,
          ),
        errors: (original) => (category) =>
          original(category).pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(httpErrorCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((err) =>
                  Effect.log(
                    `[HTTPSource] errors("${category}") status: ${err.status} url: ${err.url}`,
                  ),
                )
              : F.identity,
            config.enableSpans ? Stream.withSpan("http.source.errors") : F.identity,
          ),
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentHTTPSink
// -------------------------------------------------------------------------------------

/**
 * Wraps `HTTPSink.request` with metrics, logging, and span instrumentation.
 *
 * @since 0.1.0
 */
export const instrumentHTTPSink: Layer.Layer<HTTPSink, never, HTTPSink | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(HTTPSink, {
        request: (original) => (category, req$) => {
          const instrumented = req$.pipe(
            config.enableMetrics
              ? Stream.tap(() => Metric.increment(httpRequestCount))
              : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((req) => Effect.log(`[HTTPSink] request("${category}") url: ${req.url}`))
              : F.identity,
          )
          return config.enableSpans
            ? original(category, instrumented).pipe(Effect.withSpan("http.sink.request"))
            : original(category, instrumented)
        },
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentHTTP: convenience merge
// -------------------------------------------------------------------------------------

/**
 * Convenience layer that instruments both `HTTPSource` and `HTTPSink`.
 *
 * @since 0.1.0
 */
export const instrumentHTTP: Layer.Layer<
  HTTPSource | HTTPSink,
  never,
  HTTPSource | HTTPSink | DevToolsConfig
> = Layer.merge(instrumentHTTPSource, instrumentHTTPSink)
