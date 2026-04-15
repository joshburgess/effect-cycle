import { Effect, type Layer } from "effect"
import type { App } from "effect-cycle-core"

export const runTest = <E, R>(app: App<void, E, R>, layers: Layer.Layer<R>): Promise<void> =>
  Effect.runPromise(app.pipe(Effect.provide(layers)))
