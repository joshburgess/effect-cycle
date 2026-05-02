import type { Effect, Schema, Stream } from "effect"
import {
  WSError,
  type WSSink,
  type WSSource,
  validatedMessage,
  validatedMessageEffect,
} from "effect-cycle-ws"
import type { ParseError } from "effect/ParseResult"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// WSSource / WSSink shape
// -------------------------------------------------------------------------------------

describe("WSSource type", () => {
  it("messages stream fails with WSError", () => {
    const get = (s: WSSource["Type"]) => s.messages
    expectTypeOf(get).returns.toEqualTypeOf<Stream.Stream<MessageEvent, WSError>>()
  })

  it("connected resolves with WSError on failure", () => {
    const get = (s: WSSource["Type"]) => s.connected
    expectTypeOf(get).returns.toEqualTypeOf<Effect.Effect<void, WSError>>()
  })
})

describe("WSSink type", () => {
  it("send accepts string | ArrayBuffer messages", () => {
    const call = (s: WSSink["Type"], m$: Stream.Stream<string | ArrayBuffer>) => s.send(m$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// validatedMessage / validatedMessageEffect
// -------------------------------------------------------------------------------------

interface Frame {
  readonly type: "ping" | "pong"
}

describe("validatedMessage types", () => {
  it("error channel unions WSError | ParseError", () => {
    const call = (s: WSSource["Type"], schema: Schema.Schema<Frame>) => validatedMessage(s, schema)
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<Frame, WSError | ParseError>>()
  })

  it("validatedMessageEffect requires WSSource", () => {
    const call = (schema: Schema.Schema<Frame>) => validatedMessageEffect(schema)
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<Stream.Stream<Frame, WSError | ParseError>, never, WSSource>
    >()
  })
})

// -------------------------------------------------------------------------------------
// WSError shape
// -------------------------------------------------------------------------------------

describe("WSError type", () => {
  it("has _tag and url, with optional code and reason", () => {
    const make = (url: string) => new WSError({ url })
    expectTypeOf(make).returns.toMatchTypeOf<{
      readonly _tag: "WSError"
      readonly url: string
      readonly code?: number
      readonly reason?: string
    }>()
  })
})
