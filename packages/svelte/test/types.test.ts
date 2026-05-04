import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMSource } from "effect-cycle-dom"
import { ReactiveDriverLive, type ReactiveSink, ReactiveSinkLive } from "effect-cycle-svelte"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// ReactiveSink shape
// -------------------------------------------------------------------------------------

describe("ReactiveSink (svelte) type", () => {
  it("mount takes a component and props and returns Effect<void>", () => {
    const call = (s: ReactiveSink["Type"]) => s.mount(null as never, {})
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })

  it("fromStream returns Effect<Readable<A>>", () => {
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
