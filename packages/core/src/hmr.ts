import { Fiber, type Layer, ManagedRuntime } from "effect"
import type { App } from "./App.js"

/**
 * A runtime that supports hot module replacement.
 * Manages a single running fiber that can be interrupted and restarted
 * with new app code while preserving the driver layers.
 */
export interface HotRuntime<R> {
  /** Run (or restart) the app. Interrupts any currently running fiber first. */
  readonly run: <E>(app: App<void, E, R>) => Promise<void>
  /** Dispose the entire runtime, releasing all driver resources. */
  readonly dispose: () => Promise<void>
}

/**
 * Creates a HotRuntime from driver layers.
 * The drivers are initialized once and shared across hot reloads.
 * Only the app fiber is interrupted and restarted on each `run()` call.
 */
export const makeHotRuntime = <R>(drivers: Layer.Layer<R>): HotRuntime<R> => {
  const runtime = ManagedRuntime.make(drivers)
  let currentFiber: Fiber.RuntimeFiber<void, unknown> | null = null
  let disposed = false

  return {
    run: async (app) => {
      if (currentFiber !== null) {
        await runtime.runPromise(Fiber.interrupt(currentFiber))
        currentFiber = null
      }
      currentFiber = runtime.runFork(app)
    },
    dispose: async () => {
      if (disposed) return
      disposed = true
      if (currentFiber !== null) {
        await runtime.runPromise(Fiber.interrupt(currentFiber))
        currentFiber = null
      }
      await runtime.dispose()
    },
  }
}
