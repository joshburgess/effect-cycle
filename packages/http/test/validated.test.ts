import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema, Stream } from "effect"
import { HTTPSource, validatedResponse, validatedResponseEffect } from "effect-cycle-http"
import { TestHTTPSource } from "effect-cycle-testing"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResponse = (body: unknown, status = 200): HttpClientResponse.HttpClientResponse =>
  HttpClientResponse.fromWeb(
    HttpClientRequest.get("https://api.example.com/test"),
    new Response(JSON.stringify(body), { status }),
  )

// ---------------------------------------------------------------------------
// Schema under test
// ---------------------------------------------------------------------------

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
})

type User = typeof UserSchema.Type

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validatedResponse", () => {
  it.effect("valid JSON matching the schema produces typed values", () =>
    Effect.gen(function* () {
      const source = yield* HTTPSource

      const users$ = validatedResponse(source, "users", UserSchema)

      const result = Chunk.toArray(yield* users$.pipe(Stream.take(2), Stream.runCollect))

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1, name: "Alice" })
      expect(result[1]).toEqual({ id: 2, name: "Bob" })
    }).pipe(
      Effect.provide(
        TestHTTPSource({
          users: [makeResponse({ id: 1, name: "Alice" }), makeResponse({ id: 2, name: "Bob" })],
        }),
      ),
    ),
  )

  it.effect("valid JSON NOT matching the schema produces ParseError", () =>
    Effect.gen(function* () {
      const source = yield* HTTPSource

      const users$ = validatedResponse(source, "users", UserSchema)

      const result = yield* users$.pipe(Stream.take(1), Stream.runCollect, Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("ParseError")
      }
    }).pipe(
      Effect.provide(
        TestHTTPSource({
          users: [makeResponse({ id: "not-a-number", name: 42 })],
        }),
      ),
    ),
  )

  it.effect("works end-to-end with validatedResponseEffect and TestHTTPSource", () =>
    Effect.gen(function* () {
      const users$ = yield* validatedResponseEffect("users", UserSchema)

      const result: ReadonlyArray<User> = Chunk.toArray(
        yield* users$.pipe(Stream.take(1), Stream.runCollect),
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 99, name: "Charlie" })
    }).pipe(
      Effect.provide(
        TestHTTPSource({
          users: [makeResponse({ id: 99, name: "Charlie" })],
        }),
      ),
    ),
  )
})
