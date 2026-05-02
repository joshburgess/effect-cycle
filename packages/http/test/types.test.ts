import type * as HttpClientError from "@effect/platform/HttpClientError"
import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import type { Effect, Schema, Stream } from "effect"
import {
  HTTPError,
  type HTTPSink,
  type HTTPSource,
  validatedResponse,
  validatedResponseEffect,
} from "effect-cycle-http"
import type { ParseError } from "effect/ParseResult"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// HTTPSource / HTTPSink shape
// -------------------------------------------------------------------------------------

describe("HTTPSource type", () => {
  it("response returns Stream<HttpClientResponse>", () => {
    const call = (s: HTTPSource["Type"]) => s.response("users")
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<HttpClientResponse.HttpClientResponse>>()
  })

  it("errors returns Stream<HTTPError>", () => {
    const call = (s: HTTPSource["Type"]) => s.errors("users")
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<HTTPError>>()
  })
})

describe("HTTPSink type", () => {
  it("request takes a category and a request stream", () => {
    const call = (s: HTTPSink["Type"], req$: Stream.Stream<HttpClientRequest.HttpClientRequest>) =>
      s.request("users", req$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })
})

// -------------------------------------------------------------------------------------
// validatedResponse / validatedResponseEffect
// -------------------------------------------------------------------------------------

interface User {
  readonly id: number
  readonly name: string
}

describe("validatedResponse types", () => {
  it("error channel unions ResponseError | ParseError", () => {
    const call = (s: HTTPSource["Type"], schema: Schema.Schema<User>) =>
      validatedResponse(s, "users", schema)
    expectTypeOf(call).returns.toEqualTypeOf<
      Stream.Stream<User, HttpClientError.ResponseError | ParseError>
    >()
  })

  it("validatedResponseEffect requires HTTPSource", () => {
    const call = (schema: Schema.Schema<User>) => validatedResponseEffect("users", schema)
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<
        Stream.Stream<User, HttpClientError.ResponseError | ParseError>,
        never,
        HTTPSource
      >
    >()
  })
})

// -------------------------------------------------------------------------------------
// HTTPError shape
// -------------------------------------------------------------------------------------

describe("HTTPError type", () => {
  it("has _tag, status, body, and url", () => {
    const make = (status: number, body: string, url: string) => new HTTPError({ status, body, url })
    expectTypeOf(make).returns.toMatchTypeOf<{
      readonly _tag: "HTTPError"
      readonly status: number
      readonly body: string
      readonly url: string
    }>()
  })
})
