import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema, Stream } from "effect"
import { WSSource, validatedMessage, validatedMessageEffect } from "effect-cycle-ws"
import { TestWSSource } from "effect-cycle-testing"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMessageEvent = (data: unknown): MessageEvent =>
  new MessageEvent("message", { data: JSON.stringify(data) })

// ---------------------------------------------------------------------------
// Schema under test
// ---------------------------------------------------------------------------

const TickSchema = Schema.Struct({
  seq: Schema.Number,
  value: Schema.String,
})

type Tick = typeof TickSchema.Type

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validatedMessage", () => {
  it.effect("valid data matching the schema produces typed values", () =>
    Effect.gen(function* () {
      const source = yield* WSSource

      const ticks$ = validatedMessage(source, Schema.parseJson(TickSchema))

      const result = Chunk.toArray(yield* ticks$.pipe(Stream.take(2), Stream.runCollect))

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ seq: 1, value: "alpha" })
      expect(result[1]).toEqual({ seq: 2, value: "beta" })
    }).pipe(
      Effect.provide(
        TestWSSource([
          makeMessageEvent({ seq: 1, value: "alpha" }),
          makeMessageEvent({ seq: 2, value: "beta" }),
        ]),
      ),
    ),
  )

  it.effect("data NOT matching the schema produces ParseError", () =>
    Effect.gen(function* () {
      const source = yield* WSSource

      const ticks$ = validatedMessage(source, Schema.parseJson(TickSchema))

      const result = yield* ticks$.pipe(Stream.take(1), Stream.runCollect, Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("ParseError")
      }
    }).pipe(
      Effect.provide(
        TestWSSource([makeMessageEvent({ seq: "not-a-number", value: 99 })]),
      ),
    ),
  )

  it.effect("works end-to-end with validatedMessageEffect and TestWSSource", () =>
    Effect.gen(function* () {
      const ticks$ = yield* validatedMessageEffect(Schema.parseJson(TickSchema))

      const result: ReadonlyArray<Tick> = Chunk.toArray(
        yield* ticks$.pipe(Stream.take(1), Stream.runCollect),
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ seq: 42, value: "gamma" })
    }).pipe(
      Effect.provide(
        TestWSSource([makeMessageEvent({ seq: 42, value: "gamma" })]),
      ),
    ),
  )
})
