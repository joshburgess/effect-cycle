import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { instrumentService, wsMessageCount, wsSendCount } from "effect-cycle-core"
import { WSSink, WSSource } from "effect-cycle-ws"
import { DevToolsConfig } from "./DevToolsConfig.js"

// -------------------------------------------------------------------------------------
// instrumentWSSource
// -------------------------------------------------------------------------------------

const instrumentWSSource: Layer.Layer<WSSource, never, WSSource | DevToolsConfig> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      return instrumentService(WSSource, {
        messages: (original) =>
          original.pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(wsMessageCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((msg) =>
                  Effect.log(`[WSSource] message received: ${String(msg.data).slice(0, 80)}`),
                )
              : F.identity,
            config.enableSpans ? Stream.withSpan("ws.source.messages") : F.identity,
          ),
      })
    }),
  )

// -------------------------------------------------------------------------------------
// instrumentWSSink
// -------------------------------------------------------------------------------------

const instrumentWSSink: Layer.Layer<WSSink, never, WSSink | DevToolsConfig> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    return instrumentService(WSSink, {
      send: (original) => (msg$) => {
        const instrumented = msg$.pipe(
          config.enableMetrics ? Stream.tap(() => Metric.increment(wsSendCount)) : F.identity,
          config.logLevel !== "none"
            ? Stream.tap((msg) =>
                Effect.log(
                  `[WSSink] send: ${typeof msg === "string" ? msg.slice(0, 80) : "[ArrayBuffer]"}`,
                ),
              )
            : F.identity,
        )
        return config.enableSpans
          ? original(instrumented).pipe(Effect.withSpan("ws.sink.send"))
          : original(instrumented)
      },
    })
  }),
)

// -------------------------------------------------------------------------------------
// instrumentWS: convenience merge
// -------------------------------------------------------------------------------------

export const instrumentWS: Layer.Layer<
  WSSource | WSSink,
  never,
  WSSource | WSSink | DevToolsConfig
> = Layer.merge(instrumentWSSource, instrumentWSSink)
