import { Context, type Effect, type Fiber, type Layer, type ManagedRuntime } from "effect"
import {
  type App,
  type HmrHook,
  type HotRuntime,
  installHmr,
  instrumentService,
  makeHotRuntime,
  makeManagedRuntime,
  run,
  withEffectSpan,
} from "effect-cycle-core"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------
//
// These tests run inside `it`, but every type assertion is performed against a
// thunk that is *declared* but never invoked. That keeps assertions purely
// type-level: vitest passes the test if the file type-checks, regardless of
// whether any code in it runs.

class Greeter extends Context.Tag("test/Greeter")<
  Greeter,
  {
    readonly greet: (name: string) => Effect.Effect<string>
    readonly ping: Effect.Effect<string>
    readonly count: number
  }
>() {}

class OtherTag extends Context.Tag("test/OtherTag")<OtherTag, { readonly v: number }>() {}

// -------------------------------------------------------------------------------------
// withEffectSpan
// -------------------------------------------------------------------------------------

describe("withEffectSpan types", () => {
  it("preserves args, success, error, and requirement channels", () => {
    const wrap = (fn: (n: number, s: string) => Effect.Effect<boolean, "boom", Greeter>) =>
      withEffectSpan("op", fn)
    expectTypeOf(wrap).returns.parameters.toEqualTypeOf<[number, string]>()
    expectTypeOf(wrap).returns.returns.toEqualTypeOf<Effect.Effect<boolean, "boom", Greeter>>()
  })

  it("preserves zero-arg functions", () => {
    const wrap = (fn: () => Effect.Effect<number>) => withEffectSpan("op", fn)
    expectTypeOf(wrap).returns.parameters.toEqualTypeOf<[]>()
    expectTypeOf(wrap).returns.returns.toEqualTypeOf<Effect.Effect<number>>()
  })
})

// -------------------------------------------------------------------------------------
// instrumentService
// -------------------------------------------------------------------------------------

describe("instrumentService types", () => {
  it("returns Layer<Tag, never, Tag>", () => {
    const layer = () =>
      instrumentService(Greeter, {
        greet: (orig) => (name) => orig(name),
      })
    expectTypeOf(layer).returns.toEqualTypeOf<Layer.Layer<Greeter, never, Greeter>>()
  })

  it("accepts a wrapper for any subset of keys", () => {
    const _none = () => instrumentService(Greeter, {})
    const _one = () => instrumentService(Greeter, { ping: (orig) => orig })
    const _all = () =>
      instrumentService(Greeter, {
        greet: (orig) => orig,
        ping: (orig) => orig,
      })
    void _none
    void _one
    void _all
  })

  it("rejects keys not on the service", () => {
    const _bad = () =>
      instrumentService(Greeter, {
        // @ts-expect-error - "missing" is not a key on Greeter
        missing: (orig) => orig,
      })
    void _bad
  })

  it("infers each wrapper's `original` parameter as the exact method type", () => {
    const _check = () =>
      instrumentService(Greeter, {
        greet: (orig) => {
          expectTypeOf(orig).toEqualTypeOf<(name: string) => Effect.Effect<string>>()
          return orig
        },
        ping: (orig) => {
          expectTypeOf(orig).toEqualTypeOf<Effect.Effect<string>>()
          return orig
        },
      })
    void _check
  })

  it("rejects wrappers that return the wrong type", () => {
    const _bad = () =>
      instrumentService(Greeter, {
        // @ts-expect-error - returning number where (name: string) => Effect<string> is required
        greet: (_orig) => 42,
      })
    void _bad
  })
})

// -------------------------------------------------------------------------------------
// run / makeManagedRuntime
// -------------------------------------------------------------------------------------

describe("run / makeManagedRuntime types", () => {
  it("run returns Fiber.RuntimeFiber<void, E>", () => {
    const call = (app: App<void, "fail", Greeter>, drivers: Layer.Layer<Greeter>) =>
      run(app, drivers)
    expectTypeOf(call).returns.toEqualTypeOf<Fiber.RuntimeFiber<void, "fail">>()
  })

  it("run rejects a layer that does not satisfy the app's requirements", () => {
    const _bad = (app: App<void, never, Greeter>, wrong: Layer.Layer<OtherTag>) =>
      // @ts-expect-error - layer provides OtherTag, app requires Greeter
      run(app, wrong)
    void _bad
  })

  it("makeManagedRuntime preserves the requirement channel", () => {
    const call = (drivers: Layer.Layer<Greeter | OtherTag>) => makeManagedRuntime(drivers)
    expectTypeOf(call).returns.toEqualTypeOf<
      ManagedRuntime.ManagedRuntime<Greeter | OtherTag, never>
    >()
  })
})

// -------------------------------------------------------------------------------------
// makeHotRuntime / installHmr
// -------------------------------------------------------------------------------------

describe("makeHotRuntime / installHmr types", () => {
  it("makeHotRuntime returns Effect<HotRuntime<R>>", () => {
    const call = (drivers: Layer.Layer<Greeter>) => makeHotRuntime(drivers)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<HotRuntime<Greeter>>>()
  })

  it("HotRuntime.run accepts an App with matching R", () => {
    const call = (rt: HotRuntime<Greeter>, app: App<void, "boom", Greeter>) => rt.run(app)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })

  it("installHmr accepts undefined for production builds", () => {
    const call = (
      drivers: Layer.Layer<Greeter>,
      app: App<void, never, Greeter>,
      hot: HmrHook | undefined,
    ) => installHmr(drivers, app, hot)
    expectTypeOf(call).returns.toEqualTypeOf<void>()
  })
})
