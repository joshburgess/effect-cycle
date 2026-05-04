import type { Effect, Layer, Stream } from "effect"
import type { DOMError, DOMScheduler, DOMSource } from "effect-cycle-dom"
import { type DOMSink, type VNode, isolate } from "effect-cycle-morphdom"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// VNode (morphdom)
// -------------------------------------------------------------------------------------

describe("VNode (morphdom) type", () => {
  it("is currently an alias for string", () => {
    expectTypeOf<VNode>().toEqualTypeOf<string>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSink (morphdom) type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate (morphdom) types", () => {
  it("preserves A and unions DOMError into E, requires DOMSource | DOMSink | DOMScheduler", () => {
    const call = (component: Effect.Effect<number, "compFail", DOMSource | DOMSink>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<number, "compFail" | DOMError, DOMSource | DOMSink | DOMScheduler>
    >()
  })

  it("substitutes DOMSource | DOMSink for any other R via Exclude", () => {
    interface Foo {
      readonly _tag: "Foo"
    }
    const call = (component: Effect.Effect<void, never, DOMSource | DOMSink | Foo>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<void, DOMError, Foo | DOMSource | DOMSink | DOMScheduler>
    >()
  })
})

// -------------------------------------------------------------------------------------
// Layer types
// -------------------------------------------------------------------------------------

describe("Layer types", () => {
  it("DOMSink Tag shape is stable", () => {
    type SinkShape = DOMSink["Type"]
    expectTypeOf<SinkShape>().toMatchTypeOf<{
      readonly render: (v$: Stream.Stream<VNode>) => Effect.Effect<void>
    }>()
  })

  it("Layer.Layer<DOMSource | DOMSink, ...> is satisfied by relevant exports", () => {
    type Driver = Layer.Layer<DOMSource | DOMSink, never, never>
    expectTypeOf<Driver>().not.toBeAny()
  })
})
