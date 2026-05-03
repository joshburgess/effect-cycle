import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMSource } from "effect-cycle-dom"
import { type DOMSink, type VNode, isolate } from "effect-cycle-lit"
import type { TemplateResult } from "lit-html"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// VNode (lit)
// -------------------------------------------------------------------------------------

describe("VNode (lit) type", () => {
  it("aliases lit-html's TemplateResult", () => {
    expectTypeOf<VNode>().toEqualTypeOf<TemplateResult>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSink (lit) type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate (lit) types", () => {
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
