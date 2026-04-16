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
 * Create a ManagedRuntime from driver layers. The runtime keeps driver
 * resources alive across multiple `runFork`/`runPromise` calls.
 *
 * For hot module replacement, prefer {@link makeHotRuntime} which manages
 * a single running fiber automatically.
 *
 * Call `runtime.dispose()` for full shutdown.
 *
 * @since 0.1.0
 */
export const makeManagedRuntime = <R>(
  drivers: Layer.Layer<R>,
): ManagedRuntime.ManagedRuntime<R, never> => ManagedRuntime.make(drivers)
