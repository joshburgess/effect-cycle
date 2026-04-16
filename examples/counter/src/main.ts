import { Effect, Layer } from "effect"
import { makeHotRuntime } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import app from "./App.js"

const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

const runtime = Effect.runSync(makeHotRuntime(drivers))

Effect.runSync(runtime.run(app))

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    Effect.runSync(runtime.run(app))
  })

  import.meta.hot.dispose(() => {
    Effect.runSync(runtime.dispose)
  })
}
