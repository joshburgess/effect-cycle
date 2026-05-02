import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { httpErrorCount, httpRequestCount, instrumentService } from "effect-cycle-core"
import { HTTPSink, HTTPSource } from "effect-cycle-http"
import { DevToolsConfig } from "./DevToolsConfig.js"

// -------------------------------------------------------------------------------------
// instrumentHTTPSource
// -------------------------------------------------------------------------------------

const instrumentHTTPSource: Layer.Layer<HTTPSource, never, HTTPSource | DevToolsConfig> =
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

const instrumentHTTPSink: Layer.Layer<HTTPSink, never, HTTPSink | DevToolsConfig> =
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

export const instrumentHTTP: Layer.Layer<
  HTTPSource | HTTPSink,
  never,
  HTTPSource | HTTPSink | DevToolsConfig
> = Layer.merge(instrumentHTTPSource, instrumentHTTPSink)
