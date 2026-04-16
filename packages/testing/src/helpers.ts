import { Effect, type Layer } from "effect"
import type { App } from "effect-cycle-core"

/**
 * Convenience function to run an effect-cycle app against test layers.
 *
 * Provides the given layers and runs the app as a Promise.
 *
 * @param app - The effect-cycle app to run.
 * @param layers - Test driver layers satisfying the app's requirements.
 * @returns A Promise that resolves when the app completes.
 *
 * @since 0.0.1
 */
export const runTest = <E, R>(app: App<void, E, R>, layers: Layer.Layer<R>): Promise<void> =>
  Effect.runPromise(app.pipe(Effect.provide(layers)))
