import { Effect, Fiber, type Layer, ManagedRuntime, Option, Ref } from "effect"
import type { App } from "./App.js"

/**
 * A runtime that supports hot module replacement.
 * Manages a single running fiber that can be interrupted and restarted
 * with new app code while preserving the driver layers.
 */
export interface HotRuntime<R> {
  /** Run (or restart) the app. Interrupts any currently running fiber first. */
  readonly run: <E>(app: App<void, E, R>) => Effect.Effect<void>
  /** Dispose the entire runtime, releasing all driver resources. */
  readonly dispose: Effect.Effect<void>
}

/**
 * Creates a HotRuntime from driver layers.
 * The drivers are initialized once and shared across hot reloads.
 * Only the app fiber is interrupted and restarted on each `run()` call.
 *
 * Returns an Effect because internal state (Ref) must be allocated effectfully.
 * Run with `Effect.runPromise` at the application boundary.
 */
export const makeHotRuntime = <R>(drivers: Layer.Layer<R>): Effect.Effect<HotRuntime<R>> =>
  Effect.gen(function* () {
    const runtime = yield* Effect.sync(() => ManagedRuntime.make(drivers))
    const currentFiber = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, unknown>>>(
      Option.none(),
    )
    const disposed = yield* Ref.make(false)

    return {
      run: (app) =>
        Effect.gen(function* () {
          const prev = yield* Ref.get(currentFiber)
          if (Option.isSome(prev)) {
            yield* Effect.promise(() => runtime.runPromise(Fiber.interrupt(prev.value)))
          }
          const fiber = yield* Effect.sync(() => runtime.runFork(app))
          yield* Ref.set(currentFiber, Option.some(fiber))
        }),

      dispose: Effect.gen(function* () {
        const alreadyDisposed = yield* Ref.get(disposed)
        if (alreadyDisposed) return
        yield* Ref.set(disposed, true)
        const prev = yield* Ref.get(currentFiber)
        if (Option.isSome(prev)) {
          yield* Effect.promise(() => runtime.runPromise(Fiber.interrupt(prev.value)))
          yield* Ref.set(currentFiber, Option.none())
        }
        yield* Effect.promise(() => runtime.dispose())
      }),
    }
  })
