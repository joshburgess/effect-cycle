import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { instrumentService, routerNavCount } from "effect-cycle-core"
import { RouterSink, RouterSource } from "effect-cycle-router"
import { DevToolsConfig } from "./DevToolsConfig.js"

// -------------------------------------------------------------------------------------
// instrumentRouterSource
// -------------------------------------------------------------------------------------

/**
 * Wraps `RouterSource.location$` with metrics, logging, and span instrumentation.
 *
 * @since 0.0.1
 */
export const instrumentRouterSource: Layer.Layer<
  RouterSource,
  never,
  RouterSource | DevToolsConfig
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    return instrumentService(RouterSource, {
      location$: (original) =>
        original.pipe(
          config.enableMetrics ? Stream.tap(() => Metric.increment(routerNavCount)) : F.identity,
          config.logLevel !== "none"
            ? Stream.tap((loc) =>
                Effect.log(`[RouterSource] location changed: ${loc.path}`),
              )
            : F.identity,
          config.enableSpans ? Stream.withSpan("router.source.location") : F.identity,
        ),
    })
  }),
)

// -------------------------------------------------------------------------------------
// instrumentRouterSink
// -------------------------------------------------------------------------------------

/**
 * Wraps `RouterSink.push` and `RouterSink.replace` with logging and span instrumentation.
 *
 * @since 0.0.1
 */
export const instrumentRouterSink: Layer.Layer<RouterSink, never, RouterSink | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(RouterSink, {
        push: (original) => (path) => {
          const eff = original(path)
          const logged =
            config.logLevel !== "none"
              ? eff.pipe(Effect.tap(() => Effect.log(`[RouterSink] push("${path}")`)))
              : eff
          return config.enableSpans ? logged.pipe(Effect.withSpan("router.sink.push")) : logged
        },
        replace: (original) => (path) => {
          const eff = original(path)
          const logged =
            config.logLevel !== "none"
              ? eff.pipe(Effect.tap(() => Effect.log(`[RouterSink] replace("${path}")`)))
              : eff
          return config.enableSpans
            ? logged.pipe(Effect.withSpan("router.sink.replace"))
            : logged
        },
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentRouter -- convenience merge
// -------------------------------------------------------------------------------------

/**
 * Convenience layer that instruments both `RouterSource` and `RouterSink`.
 *
 * @since 0.0.1
 */
export const instrumentRouter: Layer.Layer<
  RouterSource | RouterSink,
  never,
  RouterSource | RouterSink | DevToolsConfig
> = Layer.merge(instrumentRouterSource, instrumentRouterSink)
