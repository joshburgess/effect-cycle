import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMSource } from "effect-cycle-dom"
import { type DOMSink, type VNode, isolate } from "effect-cycle-vue"
import { describe, expectTypeOf, it } from "vitest"
import type { VNode as VueVNode } from "vue"

// -------------------------------------------------------------------------------------
// VNode (vue)
// -------------------------------------------------------------------------------------

describe("VNode (vue) type", () => {
  it("aliases vue's VNode", () => {
    expectTypeOf<VNode>().toEqualTypeOf<VueVNode>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSink (vue) type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate (vue) types", () => {
  it("preserves A and unions DOMError into E, requires DOMSource | DOMSink", () => {
    const call = (component: Effect.Effect<number, "compFail", DOMSource | DOMSink>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<number, "compFail" | DOMError, DOMSource | DOMSink>
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
