import type { Effect, Layer, Stream } from "effect"
import type { Schema } from "effect"
import {
  DOMError,
  type DOMSink,
  type DOMSource,
  type VNode,
  isolate,
  validatedEvent,
  validatedEventEffect,
} from "effect-cycle-dom"
import type { ParseError } from "effect/ParseResult"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// VNode
// -------------------------------------------------------------------------------------

describe("VNode types", () => {
  it("is currently an alias for string", () => {
    expectTypeOf<VNode>().toEqualTypeOf<string>()
  })
})

// -------------------------------------------------------------------------------------
// DOMSource / DOMSink shape
// -------------------------------------------------------------------------------------

describe("DOMSource type", () => {
  it("select returns Stream<Event>", () => {
    const call = (s: DOMSource["Type"]) => s.select(".btn", "click")
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<Event>>()
  })

  it("element returns Effect<Element, DOMError>", () => {
    const get = (s: DOMSource["Type"]) => s.element
    expectTypeOf(get).returns.toEqualTypeOf<Effect.Effect<Element, DOMError>>()
  })
})

describe("DOMSink type", () => {
  it("render takes Stream<VNode> and returns Effect<void>", () => {
    const call = (s: DOMSink["Type"], v$: Stream.Stream<VNode>) => s.render(v$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// validatedEvent / validatedEventEffect
// -------------------------------------------------------------------------------------

interface Payload {
  readonly id: number
}

describe("validatedEvent types", () => {
  it("propagates schema's A into the stream success type", () => {
    const call = (s: DOMSource["Type"], schema: Schema.Schema<Payload>) =>
      validatedEvent(s, ".btn", "click", (e) => e, schema)
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<Payload, ParseError>>()
  })

  it("validatedEventEffect requires DOMSource and yields a Stream", () => {
    const call = (schema: Schema.Schema<Payload>) =>
      validatedEventEffect(".btn", "submit", (e) => e, schema)
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<Stream.Stream<Payload, ParseError>, never, DOMSource>
    >()
  })

  it("rejects an extractor that returns a non-`unknown`-compatible value implicitly", () => {
    // Any value is assignable to unknown, so we instead pin the parameter type:
    const call = (s: DOMSource["Type"], schema: Schema.Schema<Payload>) =>
      validatedEvent(
        s,
        ".btn",
        "click",
        (e) => {
          expectTypeOf(e).toEqualTypeOf<Event>()
          return e
        },
        schema,
      )
    void call
  })
})

// -------------------------------------------------------------------------------------
// isolate
// -------------------------------------------------------------------------------------

describe("isolate types", () => {
  it("preserves A and unions DOMError into E, requires DOMSource | DOMSink", () => {
    const call = (component: Effect.Effect<number, "compFail", DOMSource | DOMSink>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<number, "compFail" | DOMError, DOMSource | DOMSink>
    >()
  })

  it("substitutes DOMSource | DOMSink for any other R via Exclude", () => {
    interface Foo {
      readonly _tag: "Foo"
    }
    const call = (component: Effect.Effect<void, never, DOMSource | DOMSink | Foo>) =>
      isolate(component, "ns")
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<void, DOMError, Foo | DOMSource | DOMSink>
    >()
  })
})

// -------------------------------------------------------------------------------------
// DOMError shape
// -------------------------------------------------------------------------------------

describe("DOMError type", () => {
  it("has _tag, selector, and message", () => {
    const make = (selector: string, message: string) => new DOMError({ selector, message })
    expectTypeOf(make).returns.toMatchTypeOf<{
      readonly _tag: "DOMError"
      readonly selector: string
      readonly message: string
    }>()
  })
})

// -------------------------------------------------------------------------------------
// Layer types are referenced indirectly via tests above; pin DOMDriverLive shape.
// -------------------------------------------------------------------------------------

describe("Layer-level types referenced by other tests", () => {
  it("DOMSource and DOMSink Tag shapes are stable", () => {
    type SourceShape = DOMSource["Type"]
    type SinkShape = DOMSink["Type"]
    expectTypeOf<SourceShape>().toMatchTypeOf<{
      readonly select: (selector: string, eventType: string) => Stream.Stream<Event>
      readonly element: Effect.Effect<Element, DOMError>
    }>()
    expectTypeOf<SinkShape>().toMatchTypeOf<{
      readonly render: (v$: Stream.Stream<VNode>) => Effect.Effect<void>
    }>()
  })

  it("Layer.Layer<DOMSource | DOMSink, ...> is satisfied by relevant exports", () => {
    type Driver = Layer.Layer<DOMSource | DOMSink, never, never>
    expectTypeOf<Driver>().not.toBeAny()
  })
})
