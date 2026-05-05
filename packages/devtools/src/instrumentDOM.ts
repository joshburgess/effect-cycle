import { type Context, Effect, Function as F, Layer, Metric, Stream } from "effect"
import { domEventCount, domRenderCount, instrumentService } from "effect-cycle-core"
import { DOMSource } from "effect-cycle-dom"
import { DevToolsBus } from "./DevToolsBus.js"
import { DevToolsConfig } from "./DevToolsConfig.js"
import { DevToolsEvent } from "./DevToolsEvent.js"

// -------------------------------------------------------------------------------------
// instrumentDOMSource
// -------------------------------------------------------------------------------------

/**
 * Wraps `DOMSource.select` with metrics, logging, and span instrumentation.
 *
 * Renderer-agnostic: works with any renderer's driver since `DOMSource`
 * lives in `effect-cycle-dom` (the renderer-agnostic abstraction).
 *
 * @since 0.1.0
 */
export const instrumentDOMSource: Layer.Layer<
  DOMSource,
  never,
  DOMSource | DevToolsConfig | DevToolsBus
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    const bus = yield* DevToolsBus
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
          config.enableEvents
            ? Stream.tap((event) =>
                bus.publish(
                  DevToolsEvent.DOMEvent({
                    at: Date.now(),
                    selector,
                    eventType,
                    eventName: event.type,
                  }),
                ),
              )
            : F.identity,
          config.enableSpans ? Stream.withSpan("dom.source.select") : F.identity,
        ),
    })
  }),
)

// -------------------------------------------------------------------------------------
// instrumentDOMSink (factory: takes the renderer's DOMSink Tag)
// -------------------------------------------------------------------------------------

/**
 * Service shape required of any renderer's DOMSink Tag.
 */
type DOMSinkService<V> = {
  readonly render: (vdom$: Stream.Stream<V>) => Effect.Effect<void>
}

/**
 * Wraps a renderer's `DOMSink.render` with metrics, logging, and span
 * instrumentation. Pass the renderer's `DOMSink` Tag to bind the layer
 * to that renderer.
 *
 * @example
 * ```ts
 * import { DOMSink } from "effect-cycle-morphdom"
 * const layer = instrumentDOMSink(DOMSink)
 * ```
 *
 * @since 0.1.0
 */
export const instrumentDOMSink = <Id, V>(
  tag: Context.Tag<Id, DOMSinkService<V>>,
): Layer.Layer<Id, never, Id | DevToolsConfig | DevToolsBus> =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      const bus = yield* DevToolsBus
      return instrumentService(tag, {
        render: (original) => (vdom$) => {
          const instrumented = vdom$.pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(domRenderCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap(() => Effect.log("[DOMSink] render called"))
              : F.identity,
            config.enableEvents
              ? Stream.tap(() => bus.publish(DevToolsEvent.DOMRender({ at: Date.now() })))
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
// instrumentDOM (factory: combined source + sink)
// -------------------------------------------------------------------------------------

/**
 * Convenience factory that instruments both `DOMSource` and the given
 * renderer's `DOMSink`.
 *
 * @example
 * ```ts
 * import { DOMSink } from "effect-cycle-morphdom"
 * const layer = instrumentDOM(DOMSink)
 * ```
 *
 * @since 0.1.0
 */
export const instrumentDOM = <Id, V>(
  tag: Context.Tag<Id, DOMSinkService<V>>,
): Layer.Layer<DOMSource | Id, never, DOMSource | Id | DevToolsConfig | DevToolsBus> =>
  Layer.merge(instrumentDOMSource, instrumentDOMSink(tag))
