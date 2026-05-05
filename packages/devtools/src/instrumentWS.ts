import { Effect, Function as F, Layer, Metric, Stream } from "effect"
import { instrumentService, wsMessageCount, wsSendCount } from "effect-cycle-core"
import { WSSink, WSSource } from "effect-cycle-ws"
import { DevToolsBus } from "./DevToolsBus.js"
import { DevToolsConfig } from "./DevToolsConfig.js"
import { DevToolsEvent } from "./DevToolsEvent.js"

const previewData = (data: unknown): string => {
  if (typeof data === "string") return data.slice(0, 80)
  if (data instanceof ArrayBuffer) return `[ArrayBuffer ${data.byteLength}]`
  if (ArrayBuffer.isView(data))
    return `[${(data as ArrayBufferView).constructor.name} ${(data as ArrayBufferView).byteLength}]`
  return String(data).slice(0, 80)
}

// -------------------------------------------------------------------------------------
// instrumentWSSource
// -------------------------------------------------------------------------------------

/**
 * Wraps `WSSource.messages` with metrics, logging, and span instrumentation.
 *
 * @since 0.1.0
 */
export const instrumentWSSource: Layer.Layer<
  WSSource,
  never,
  WSSource | DevToolsConfig | DevToolsBus
> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* DevToolsConfig
    const bus = yield* DevToolsBus
    return instrumentService(WSSource, {
      messages: (original) =>
        original.pipe(
          config.enableMetrics ? Stream.tap(() => Metric.increment(wsMessageCount)) : F.identity,
          config.logLevel !== "none"
            ? Stream.tap((msg) =>
                Effect.log(`[WSSource] message received: ${previewData(msg.data)}`),
              )
            : F.identity,
          config.enableEvents
            ? Stream.tap((msg) =>
                bus.publish(
                  DevToolsEvent.WSMessageReceived({
                    at: Date.now(),
                    dataPreview: previewData(msg.data),
                  }),
                ),
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

/**
 * Wraps `WSSink.send` with metrics, logging, and span instrumentation.
 *
 * @since 0.1.0
 */
export const instrumentWSSink: Layer.Layer<WSSink, never, WSSink | DevToolsConfig | DevToolsBus> =
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      const bus = yield* DevToolsBus
      return instrumentService(WSSink, {
        send: (original) => (msg$) => {
          const instrumented = msg$.pipe(
            config.enableMetrics ? Stream.tap(() => Metric.increment(wsSendCount)) : F.identity,
            config.logLevel !== "none"
              ? Stream.tap((msg) => Effect.log(`[WSSink] send: ${previewData(msg)}`))
              : F.identity,
            config.enableEvents
              ? Stream.tap((msg) =>
                  bus.publish(
                    DevToolsEvent.WSMessageSent({
                      at: Date.now(),
                      dataPreview: previewData(msg),
                    }),
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

/**
 * Convenience layer that instruments both `WSSource` and `WSSink`.
 *
 * @since 0.1.0
 */
export const instrumentWS: Layer.Layer<
  WSSource | WSSink,
  never,
  WSSource | WSSink | DevToolsConfig | DevToolsBus
> = Layer.merge(instrumentWSSource, instrumentWSSink)
