import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { instrumentService, routerNavCount } from "effect-cycle-core"
import { RouterSink, RouterSource } from "effect-cycle-router"
import { DevToolsBus } from "./DevToolsBus.js"
import { DevToolsConfig } from "./DevToolsConfig.js"
import { DevToolsEvent } from "./DevToolsEvent.js"

// -------------------------------------------------------------------------------------
// instrumentRouterSource
// -------------------------------------------------------------------------------------

/**
 * Wraps `RouterSource.location$` with metrics, logging, and span instrumentation.
 *
 * @since 0.1.0
 */
export const instrumentRouterSource: Layer.Layer<
  RouterSource,
  never,
  RouterSource | DevToolsConfig | DevToolsBus
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    const bus = yield* DevToolsBus
    return instrumentService(RouterSource, {
      location$: (original) =>
        original.pipe(
          config.enableMetrics ? Stream.tap(() => Metric.increment(routerNavCount)) : F.identity,
          config.logLevel !== "none"
            ? Stream.tap((loc) => Effect.log(`[RouterSource] location changed: ${loc.path}`))
            : F.identity,
          config.enableEvents
            ? Stream.tap((loc) =>
                bus.publish(
                  DevToolsEvent.RouterNavigation({
                    at: Date.now(),
                    path: loc.path,
                  }),
                ),
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
 * @since 0.1.0
 */
export const instrumentRouterSink: Layer.Layer<
  RouterSink,
  never,
  RouterSink | DevToolsConfig | DevToolsBus
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    const bus = yield* DevToolsBus
    return instrumentService(RouterSink, {
      push: (original) => (path) => {
        const eff = original(path)
        const logged =
          config.logLevel !== "none"
            ? eff.pipe(Effect.tap(() => Effect.log(`[RouterSink] push("${path}")`)))
            : eff
        const evented = config.enableEvents
          ? logged.pipe(
              Effect.tap(() => bus.publish(DevToolsEvent.RouterPush({ at: Date.now(), path }))),
            )
          : logged
        return config.enableSpans ? evented.pipe(Effect.withSpan("router.sink.push")) : evented
      },
      replace: (original) => (path) => {
        const eff = original(path)
        const logged =
          config.logLevel !== "none"
            ? eff.pipe(Effect.tap(() => Effect.log(`[RouterSink] replace("${path}")`)))
            : eff
        const evented = config.enableEvents
          ? logged.pipe(
              Effect.tap(() => bus.publish(DevToolsEvent.RouterReplace({ at: Date.now(), path }))),
            )
          : logged
        return config.enableSpans ? evented.pipe(Effect.withSpan("router.sink.replace")) : evented
      },
    })
  }),
)

// -------------------------------------------------------------------------------------
// instrumentRouter: convenience merge
// -------------------------------------------------------------------------------------

/**
 * Convenience layer that instruments both `RouterSource` and `RouterSink`.
 *
 * @since 0.1.0
 */
export const instrumentRouter: Layer.Layer<
  RouterSource | RouterSink,
  never,
  RouterSource | RouterSink | DevToolsConfig | DevToolsBus
> = Layer.merge(instrumentRouterSource, instrumentRouterSink)
