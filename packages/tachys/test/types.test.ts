import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMScheduler, DOMSource } from "effect-cycle-dom"
import { type DOMSink, type VNode, isolate } from "effect-cycle-tachys"
import type { VNode as TachysVNode } from "tachys/sync"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// VNode (tachys)
// -------------------------------------------------------------------------------------

describe("VNode (tachys) type", () => {
  it("aliases tachys's VNode class instance type", () => {
    expectTypeOf<VNode>().toEqualTypeOf<TachysVNode>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSink (tachys) type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate (tachys) types", () => {
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
