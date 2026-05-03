import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMSource } from "effect-cycle-dom"
import { ReactiveDriverLive, type ReactiveSink, ReactiveSinkLive } from "effect-cycle-solid"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// ReactiveSink shape
// -------------------------------------------------------------------------------------

describe("ReactiveSink (solid) type", () => {
  it("render takes a component thunk and returns Effect<void>", () => {
    const call = (s: ReactiveSink["Type"], component: () => unknown) => s.render(component as never)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })

  it("fromStream returns Effect<Accessor<A>>", () => {
    const call = <A>(s: ReactiveSink["Type"], stream: Stream.Stream<A>, initial: A) =>
      s.fromStream(stream, initial)
    type Result = ReturnType<typeof call<number>>
    expectTypeOf<Result>().toMatchTypeOf<Effect.Effect<unknown>>()
  })
})

// -------------------------------------------------------------------------------------
// Layer types
// -------------------------------------------------------------------------------------

describe("Layer types", () => {
  it("ReactiveSinkLive is a Layer<ReactiveSink, DOMError, DOMConfig>", () => {
    expectTypeOf(ReactiveSinkLive).not.toBeAny()
  })

  it("ReactiveDriverLive provides DOMSource | ReactiveSink", () => {
    type Driver = Layer.Layer<DOMSource | ReactiveSink, DOMError, never>
    expectTypeOf<Driver>().not.toBeAny()
    expectTypeOf(ReactiveDriverLive).not.toBeAny()
  })
})
