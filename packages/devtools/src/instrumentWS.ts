import { Effect, Layer, Metric, Stream } from "effect"
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
        messages: (original) => {
          let stream = original
          if (config.enableMetrics) {
            stream = stream.pipe(Stream.tap(() => Metric.increment(wsMessageCount)))
          }
          if (config.logLevel !== "none") {
            stream = stream.pipe(
              Stream.tap((msg) =>
                Effect.log(`[WSSource] message received: ${String(msg.data).slice(0, 80)}`),
              ),
            )
          }
          if (config.enableSpans) {
            stream = stream.pipe(Stream.withSpan("ws.source.messages"))
          }
          return stream
        },
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
        let stream = msg$
        if (config.enableMetrics) {
          stream = stream.pipe(Stream.tap(() => Metric.increment(wsSendCount)))
        }
        if (config.logLevel !== "none") {
          stream = stream.pipe(
            Stream.tap((msg) =>
              Effect.log(
                `[WSSink] send: ${typeof msg === "string" ? msg.slice(0, 80) : "[ArrayBuffer]"}`,
              ),
            ),
          )
        }
        const effect = original(stream)
        if (config.enableSpans) {
          return effect.pipe(Effect.withSpan("ws.sink.send"))
        }
        return effect
      },
    })
  }),
)

// -------------------------------------------------------------------------------------
// instrumentWS — convenience merge
// -------------------------------------------------------------------------------------

export const instrumentWS: Layer.Layer<
  WSSource | WSSink,
  never,
  WSSource | WSSink | DevToolsConfig
> = Layer.merge(instrumentWSSource, instrumentWSSink)
