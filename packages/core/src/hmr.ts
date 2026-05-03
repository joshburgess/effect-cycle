import { Effect, Fiber, type Layer, ManagedRuntime, Option, Ref } from "effect"
import type { App } from "./App.js"

/**
 * Minimal subset of Vite's `import.meta.hot` interface used by {@link installHmr}.
 * Declared here to avoid taking a hard dependency on Vite types from core.
 *
 * @since 0.1.0
 */
export interface HmrHook {
  readonly accept: (cb: () => void) => void
  readonly dispose: (cb: () => void) => void
}

/**
 * A runtime that supports hot module replacement.
 * Manages a single running fiber that can be interrupted and restarted
 * with new app code while preserving the driver layers.
 *
 * @since 0.1.0
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
 *
 * @since 0.1.0
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

/**
 * Wires a {@link HotRuntime} to Vite's HMR hooks. Folds the four
 * `Effect.runSync` calls (initial start, accept callback, dispose callback,
 * and runtime construction) that every Vite-driven example would otherwise
 * repeat.
 *
 * Pass `import.meta.hot` for the `hot` argument; production builds where
 * `hot` is `undefined` will simply start the app once.
 *
 * @example
 * ```ts
 * import { installHmr } from "effect-cycle-core"
 * import { DOMConfigDefault } from "effect-cycle-dom"
 * import { DOMDriverLive } from "effect-cycle-morphdom"
 *
 * const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)
 * installHmr(drivers, app, import.meta.hot)
 * ```
 *
 * @since 0.1.0
 */
export const installHmr = <R, E>(
  drivers: Layer.Layer<R>,
  app: App<void, E, R>,
  hot: HmrHook | undefined,
): void => {
  const runtime = Effect.runSync(makeHotRuntime(drivers))
  Effect.runSync(runtime.run(app))
  if (hot) {
    hot.accept(() => {
      Effect.runSync(runtime.run(app))
    })
    hot.dispose(() => {
      Effect.runSync(runtime.dispose)
    })
  }
}
