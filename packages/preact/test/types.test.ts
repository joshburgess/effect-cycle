import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMScheduler, DOMSource } from "effect-cycle-dom"
import { type DOMSink, type VNode, isolate } from "effect-cycle-preact"
import type { JSX } from "preact"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// VNode (preact)
// -------------------------------------------------------------------------------------

describe("VNode (preact) type", () => {
  it("aliases preact's JSX.Element", () => {
    expectTypeOf<VNode>().toEqualTypeOf<JSX.Element>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSink (preact) type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate (preact) types", () => {
  it("preserves A and unions DOMError into E, requires DOMSource | DOMSink | DOMScheduler", () => {
    const call = (component: Effect.Effect<number, "compFail", DOMSource | DOMSink>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<number, "compFail" | DOMError, DOMSource | DOMSink | DOMScheduler>
    >()
  })
})

// -------------------------------------------------------------------------------------
// Layer types
// -------------------------------------------------------------------------------------

describe("Layer types", () => {
  it("Layer.Layer<DOMSource | DOMSink, ...> is satisfied by relevant exports", () => {
    type Driver = Layer.Layer<DOMSource | DOMSink, never, never>
    expectTypeOf<Driver>().not.toBeAny()
  })
})
