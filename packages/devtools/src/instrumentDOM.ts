import { Effect, Function as F, Layer, Metric, Stream } from "effect"
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
        select: (original) => (selector, eventType) =>
          original(selector, eventType).pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(domEventCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((event) =>
                  Effect.log(
                    `[DOMSource] select("${selector}", "${eventType}") emitted: ${event.type}`,
                  ),
                )
              : F.identity,
            config.enableSpans ? Stream.withSpan("dom.source.select") : F.identity,
          ),
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
          const instrumented = vdom$.pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(domRenderCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap(() => Effect.log("[DOMSink] render called"))
              : F.identity,
          )
          return config.enableSpans
            ? original(instrumented).pipe(Effect.withSpan("dom.sink.render"))
            : original(instrumented)
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
