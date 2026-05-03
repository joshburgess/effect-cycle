import { Effect, type Fiber, type Layer, ManagedRuntime } from "effect"
import type { App } from "./App.js"

/**
 * Run an effect-cycle app by providing driver layers and forking the result.
 *
 * The returned fiber can be interrupted to shut the app down. Failures in
 * the app's error channel are logged via `Effect.logError` before the fiber
 * exits, so unexpected failures are never silently dropped.
 *
 * For HMR-aware development, prefer {@link makeHotRuntime} or `installHmr`
 * from this package: they keep driver resources alive across reloads and
 * only restart the app fiber.
 *
 * @param app - The effect-cycle app to run.
 * @param drivers - A `Layer` that satisfies the app's driver requirements.
 * @returns A `RuntimeFiber` that can be interrupted to shut down.
 *
 * @example
 * ```ts
 * import { Layer } from "effect"
 * import { run } from "effect-cycle-core"
 * import { DOMConfigDefault } from "effect-cycle-dom"
 * import { DOMDriverLive } from "effect-cycle-morphdom"
 *
 * const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)
 * const fiber = run(app, drivers)
 * // ...later, on shutdown:
 * // Effect.runPromise(Fiber.interrupt(fiber))
 * ```
 *
 * @since 0.1.0
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
 * @example
 * ```ts
 * const runtime = makeManagedRuntime(drivers)
 * const fiber = runtime.runFork(app)
 * // ...later, on shutdown:
 * // await runtime.dispose()
 * ```
 *
 * @since 0.1.0
 */
export const makeManagedRuntime = <R>(
  drivers: Layer.Layer<R>,
): ManagedRuntime.ManagedRuntime<R, never> => ManagedRuntime.make(drivers)
