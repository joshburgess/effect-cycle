import { Effect, Layer, Metric, Stream } from "effect"
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
        response: (original) => (category) => {
          let stream = original(category)
          if (config.enableMetrics) {
            stream = stream.pipe(
              Stream.tap(() => Metric.increment(httpRequestCount)),
              Stream.tapError(() => Metric.increment(httpErrorCount)),
            )
          }
          if (config.logLevel !== "none") {
            stream = stream.pipe(
              Stream.tap((res) =>
                Effect.log(`[HTTPSource] response("${category}") status: ${res.status}`),
              ),
            )
          }
          if (config.enableSpans) {
            stream = stream.pipe(Stream.withSpan("http.source.response"))
          }
          return stream
        },
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
          let stream = req$
          if (config.enableMetrics) {
            stream = stream.pipe(Stream.tap(() => Metric.increment(httpRequestCount)))
          }
          if (config.logLevel !== "none") {
            stream = stream.pipe(
              Stream.tap((req) => Effect.log(`[HTTPSink] request("${category}") url: ${req.url}`)),
            )
          }
          const effect = original(category, stream)
          if (config.enableSpans) {
            return effect.pipe(Effect.withSpan("http.sink.request"))
          }
          return effect
        },
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentHTTP — convenience merge
// -------------------------------------------------------------------------------------

export const instrumentHTTP: Layer.Layer<
  HTTPSource | HTTPSink,
  never,
  HTTPSource | HTTPSink | DevToolsConfig
> = Layer.merge(instrumentHTTPSource, instrumentHTTPSink)
