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

  const connected: Effect.Effect<void, WSError> = Effect.suspend(() => {
    if (ws.readyState === WebSocket.OPEN) return Effect.void
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
      return Effect.fail(new WSError({ url: config.url }))
    }
    return Effect.async<void, WSError>((resume) => {
      const onOpen = () => {
        cleanup()
        resume(Effect.void)
      }
      const onError = () => {
        cleanup()
        resume(Effect.fail(new WSError({ url: config.url })))
      }
      const cleanup = () => {
        ws.removeEventListener("open", onOpen)
        ws.removeEventListener("error", onError)
      }
      ws.addEventListener("open", onOpen)
      ws.addEventListener("error", onError)
    })
  })

  const messages: Stream.Stream<MessageEvent, WSError> = Stream.async<MessageEvent, WSError>(
    (emit) => {
      const onMessage = (e: Event) => {
        void emit.single(e as MessageEvent)
      }
      const onError = () => {
        void emit.fail(new WSError({ url: config.url }))
      }
      const onClose = () => {
        void emit.end()
      }

      ws.addEventListener("message", onMessage)
      ws.addEventListener("error", onError)
      ws.addEventListener("close", onClose)

      return Effect.sync(() => {
        ws.removeEventListener("message", onMessage)
        ws.removeEventListener("error", onError)
        ws.removeEventListener("close", onClose)
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
