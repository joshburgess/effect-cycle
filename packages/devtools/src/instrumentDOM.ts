import { Effect, Layer, Metric, Stream } from "effect"
import { domEventCount, domRenderCount, instrumentService } from "effect-cycle-core"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { DevToolsConfig } from "./DevToolsConfig.js"

// -------------------------------------------------------------------------------------
// instrumentDOMSource
// -------------------------------------------------------------------------------------

export const instrumentDOMSource: Layer.Layer<DOMSource, never, DOMSource | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(DOMSource, {
        select: (original) => (selector) => {
          let stream = original(selector)
          if (config.enableMetrics) {
            stream = stream.pipe(Stream.tap(() => Metric.increment(domEventCount)))
          }
          if (config.logLevel !== "none") {
            stream = stream.pipe(
              Stream.tap((event) =>
                Effect.log(`[DOMSource] select("${selector}") emitted: ${event.type}`),
              ),
            )
          }
          if (config.enableSpans) {
            stream = stream.pipe(Stream.withSpan("dom.source.select"))
          }
          return stream
        },
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentDOMSink
// -------------------------------------------------------------------------------------

export const instrumentDOMSink: Layer.Layer<DOMSink, never, DOMSink | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(DOMSink, {
        render: (original) => (vdom$) => {
          let stream = vdom$
          if (config.enableMetrics) {
            stream = stream.pipe(Stream.tap(() => Metric.increment(domRenderCount)))
          }
          if (config.logLevel !== "none") {
            stream = stream.pipe(Stream.tap(() => Effect.log("[DOMSink] render called")))
          }
          const effect = original(stream)
          if (config.enableSpans) {
            return effect.pipe(Effect.withSpan("dom.sink.render"))
          }
          return effect
        },
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentDOM — convenience merge
// -------------------------------------------------------------------------------------

export const instrumentDOM: Layer.Layer<
  DOMSource | DOMSink,
  never,
  DOMSource | DOMSink | DevToolsConfig
> = Layer.merge(instrumentDOMSource, instrumentDOMSink)
