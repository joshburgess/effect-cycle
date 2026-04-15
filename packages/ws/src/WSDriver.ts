import { Effect, Layer, Stream } from "effect"
import { WSConfig } from "./WSConfig.js"
import { WSSink } from "./WSSink.js"
import { WSSource } from "./WSSource.js"
import { WSError } from "./errors.js"

const makeWSDriver = Effect.gen(function* () {
  const config = yield* WSConfig

  const ws = yield* Effect.sync(() => new WebSocket(config.url, config.protocols?.slice()))

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      ws.close()
    }),
  )

  const connected: Effect.Effect<void, WSError> = Effect.async((resume) => {
    ws.onopen = () => {
      resume(Effect.void)
    }
    ws.onerror = () => {
      resume(Effect.fail(new WSError({ url: config.url })))
    }
  })

  const messages: Stream.Stream<MessageEvent, WSError> = Stream.async<MessageEvent, WSError>(
    (emit) => {
      ws.onmessage = (e) => {
        void emit.single(e)
      }
      ws.onerror = () => {
        void emit.fail(new WSError({ url: config.url }))
      }
      ws.onclose = () => {
        void emit.end()
      }

      return Effect.sync(() => {
        ws.onmessage = null
      })
    },
  )

  const source: WSSource["Type"] = { messages, connected }

  const sink: WSSink["Type"] = {
    send: (msg$) =>
      Effect.gen(function* () {
        yield* Stream.runForEach(msg$, (m) =>
          Effect.sync(() => {
            ws.send(m)
          }),
        ).pipe(Effect.fork)
      }),
  }

  return { source, sink }
})

export const WSDriverLive: Layer.Layer<WSSource | WSSink, never, WSConfig> = Layer.scoped(
  WSSource,
  makeWSDriver.pipe(Effect.map(({ source }) => source)),
).pipe(Layer.merge(Layer.scoped(WSSink, makeWSDriver.pipe(Effect.map(({ sink }) => sink)))))
