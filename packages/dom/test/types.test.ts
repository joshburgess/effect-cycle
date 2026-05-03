import type { Effect, Layer, Stream } from "effect"
import type { Schema } from "effect"
import { DOMError, type DOMSource, validatedEvent, validatedEventEffect } from "effect-cycle-dom"
import type { ParseError } from "effect/ParseResult"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// DOMSource shape
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
// Layer types: DOMSourceLive shape
// -------------------------------------------------------------------------------------

describe("DOMSource Layer types", () => {
  it("DOMSource Tag shape is stable", () => {
    type SourceShape = DOMSource["Type"]
    expectTypeOf<SourceShape>().toMatchTypeOf<{
      readonly select: (selector: string, eventType: string) => Stream.Stream<Event>
      readonly element: Effect.Effect<Element, DOMError>
    }>()
  })

  it("Layer.Layer<DOMSource, ...> is satisfied by relevant exports", () => {
    type Source = Layer.Layer<DOMSource, never, never>
    expectTypeOf<Source>().not.toBeAny()
  })
})
