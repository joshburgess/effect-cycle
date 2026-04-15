import { Effect, type Fiber, type Layer, ManagedRuntime } from "effect"
import type { App } from "./App.js"

/**
 * Run an effect-cycle app by providing driver layers and forking.
 * Returns a fiber that can be interrupted for shutdown.
 */
export const run = <E, R>(
  app: App<void, E, R>,
  drivers: Layer.Layer<R>,
): Fiber.RuntimeFiber<void, E> =>
  app.pipe(Effect.provide(drivers), Effect.tapErrorCause(Effect.logError), Effect.runFork)

/**
 * Create a ManagedRuntime for long-lived apps. Useful for hot reload:
 * interrupt the current fiber, then re-run with updated app code.
 *
 * Call `ManagedRuntime.dispose(runtime)` for full shutdown.
 */
export const makeManagedRuntime = <R>(
  drivers: Layer.Layer<R>,
): ManagedRuntime.ManagedRuntime<R, never> => ManagedRuntime.make(drivers)
