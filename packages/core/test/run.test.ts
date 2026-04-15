import { describe, expect, it } from "@effect/vitest"
import { Context, Effect, Fiber, Layer, Ref } from "effect"
import { makeManagedRuntime, run } from "effect-cycle-core"

class CounterService extends Context.Tag("effect-cycle/test/CounterService")<
  CounterService,
  { readonly get: Effect.Effect<number>; readonly increment: Effect.Effect<void> }
>() {}

const CounterServiceLive = Layer.effect(
  CounterService,
  Effect.gen(function* () {
    const ref = yield* Ref.make(0)
    return {
      get: Ref.get(ref),
      increment: Ref.update(ref, (n) => n + 1),
    }
  }),
)

describe("run", () => {
  it.effect("executes the app and the fiber completes", () =>
    Effect.gen(function* () {
      const ref = yield* Ref.make(false)

      const app = Effect.gen(function* () {
        const counter = yield* CounterService
        yield* counter.increment
        yield* counter.increment
        yield* counter.increment
        const count = yield* counter.get
        if (count === 3) {
          yield* Ref.set(ref, true)
        }
      })

      const fiber = run(app, CounterServiceLive)
      yield* Fiber.join(fiber)

      const ran = yield* Ref.get(ref)
      expect(ran).toBe(true)
    }),
  )

  it("produces a compile error when a requirement is missing", () => {
    const app = Effect.gen(function* () {
      yield* CounterService
    })

    // @ts-expect-error — Layer<never> does not satisfy Layer<CounterService>
    run(app, Layer.empty)
  })
})

describe("makeManagedRuntime", () => {
  it.effect("creates a runtime, runs the app, and can be disposed", () =>
    Effect.gen(function* () {
      const runtime = yield* Effect.sync(() => makeManagedRuntime(CounterServiceLive))

      const result = yield* Effect.promise(() =>
        runtime.runPromise(
          Effect.gen(function* () {
            const counter = yield* CounterService
            yield* counter.increment
            return yield* counter.get
          }),
        ),
      )

      expect(result).toBe(1)

      yield* Effect.promise(() => runtime.dispose())
    }),
  )
})
