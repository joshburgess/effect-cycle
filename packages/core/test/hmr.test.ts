import { describe, expect, it } from "@effect/vitest"
import { Context, Deferred, Effect, Layer, Ref } from "effect"
import { makeHotRuntime } from "effect-cycle-core"

// -------------------------------------------------------------------------------------
// Test service
// -------------------------------------------------------------------------------------

class CounterService extends Context.Tag("effect-cycle/test/hmr/CounterService")<
  CounterService,
  { readonly get: Effect.Effect<number>; readonly increment: Effect.Effect<void> }
>() {}

const makeCounterLayer = (ref: Ref.Ref<number>) =>
  Layer.succeed(CounterService, {
    get: Ref.get(ref),
    increment: Ref.update(ref, (n) => n + 1),
  })

// -------------------------------------------------------------------------------------
// Basic run
// -------------------------------------------------------------------------------------

describe("makeHotRuntime", () => {
  it.effect("basic run: increments counter via the app", () =>
    Effect.gen(function* () {
      const ref = yield* Ref.make(0)
      const layer = makeCounterLayer(ref)
      const hot = yield* makeHotRuntime(layer)

      // Use a Deferred to know when the forked fiber has finished
      const done = yield* Deferred.make<void>()

      const app = Effect.gen(function* () {
        const counter = yield* CounterService
        yield* counter.increment
        yield* counter.increment
      }).pipe(Effect.ensuring(Deferred.succeed(done, undefined)))

      yield* hot.run(app)

      // Wait for the app to complete
      yield* Deferred.await(done)

      const count = yield* Ref.get(ref)
      expect(count).toBe(2)

      yield* hot.dispose
    }),
  )

  // -------------------------------------------------------------------------------------
  // Restart
  // -------------------------------------------------------------------------------------

  it.effect("restart: second app runs after first is interrupted", () =>
    Effect.gen(function* () {
      const ref = yield* Ref.make(0)
      const layer = makeCounterLayer(ref)
      const hot = yield* makeHotRuntime(layer)

      // First app: sets ref to 10, then signals done
      const firstDone = yield* Deferred.make<void>()
      const firstApp = Effect.gen(function* () {
        yield* Ref.set(ref, 10)
      }).pipe(Effect.ensuring(Deferred.succeed(firstDone, undefined)))

      // Second app: adds 5 to whatever is in ref, then signals done
      const secondDone = yield* Deferred.make<void>()
      const secondApp = Effect.gen(function* () {
        const counter = yield* CounterService
        yield* counter.increment
        yield* counter.increment
        yield* counter.increment
        yield* counter.increment
        yield* counter.increment
      }).pipe(Effect.ensuring(Deferred.succeed(secondDone, undefined)))

      yield* hot.run(firstApp)
      yield* Deferred.await(firstDone)

      // Restart with the second app
      yield* hot.run(secondApp)
      yield* Deferred.await(secondDone)

      const count = yield* Ref.get(ref)
      // First app set it to 10, second app incremented 5 times → 15
      expect(count).toBe(15)

      yield* hot.dispose
    }),
  )

  // -------------------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------------------

  it.effect("dispose: can be called multiple times without error", () =>
    Effect.gen(function* () {
      const ref = yield* Ref.make(0)
      const layer = makeCounterLayer(ref)
      const hot = yield* makeHotRuntime(layer)

      const done = yield* Deferred.make<void>()

      const app = Effect.gen(function* () {
        const counter = yield* CounterService
        yield* counter.increment
      }).pipe(Effect.ensuring(Deferred.succeed(done, undefined)))

      yield* hot.run(app)
      yield* Deferred.await(done)

      // First dispose: should complete cleanly
      yield* hot.dispose
      // Second dispose: should not throw (no fiber, runtime already disposed)
      yield* hot.dispose

      // No assertion needed; the test passes if no exception is thrown
      expect(true).toBe(true)
    }),
  )

  // -------------------------------------------------------------------------------------
  // Interrupt on restart
  // -------------------------------------------------------------------------------------

  it.effect("interrupt on restart: long-running app is interrupted, short app completes", () =>
    Effect.gen(function* () {
      const ref = yield* Ref.make("initial")
      const layer = Layer.empty

      const hot = yield* makeHotRuntime(layer)

      // Signal that the long app has started before sleeping
      const longStarted = yield* Deferred.make<void>()
      const shortDone = yield* Deferred.make<void>()

      // Long-running app: sets ref to "long-started", signals, then sleeps indefinitely
      const longApp = Effect.gen(function* () {
        yield* Ref.set(ref, "long-started")
        yield* Deferred.succeed(longStarted, undefined)
        yield* Effect.never
        yield* Ref.set(ref, "long-finished")
      })

      // Short app: sets ref to "short-done"
      const shortApp = Effect.gen(function* () {
        yield* Ref.set(ref, "short-done")
      }).pipe(Effect.ensuring(Deferred.succeed(shortDone, undefined)))

      // Start the long app and wait until it has actually started
      yield* hot.run(longApp)
      yield* Deferred.await(longStarted)

      // Restart: should interrupt the long app and run the short one
      yield* hot.run(shortApp)
      yield* Deferred.await(shortDone)

      const result = yield* Ref.get(ref)
      // The long app was interrupted before setting "long-finished"
      // The short app ran and set "short-done"
      expect(result).toBe("short-done")

      yield* hot.dispose
    }),
  )
})
