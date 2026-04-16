// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Schema, Stream } from "effect"
import { DOMSource, validatedEvent, validatedEventEffect } from "effect-cycle-dom"
import { TestDOMSource } from "effect-cycle-testing"

// ---------------------------------------------------------------------------
// Schema under test
// ---------------------------------------------------------------------------

const FormDataSchema = Schema.Struct({
  username: Schema.String,
  age: Schema.Number,
})

type FormData = typeof FormDataSchema.Type

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCustomEvent = (detail: unknown): Event =>
  new CustomEvent("submit", { detail })

const extractDetail = (event: Event): unknown => (event as CustomEvent).detail

const makeInputEvent = (value: string): Event => {
  const input = document.createElement("input")
  input.value = value
  return new InputEvent("input", { bubbles: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validatedEvent", () => {
  it.effect("valid detail matching the schema produces typed values", () =>
    Effect.gen(function* () {
      const source = yield* DOMSource

      const form$ = validatedEvent(source, "form", "submit", extractDetail, FormDataSchema)

      const result = Chunk.toArray(yield* form$.pipe(Stream.take(2), Stream.runCollect))

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ username: "alice", age: 30 })
      expect(result[1]).toEqual({ username: "bob", age: 25 })
    }).pipe(
      Effect.provide(
        TestDOMSource({
          form: [
            makeCustomEvent({ username: "alice", age: 30 }),
            makeCustomEvent({ username: "bob", age: 25 }),
          ],
        }),
      ),
    ),
  )

  it.effect("detail NOT matching the schema produces ParseError", () =>
    Effect.gen(function* () {
      const source = yield* DOMSource

      const form$ = validatedEvent(source, "form", "submit", extractDetail, FormDataSchema)

      const result = yield* form$.pipe(Stream.take(1), Stream.runCollect, Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("ParseError")
      }
    }).pipe(
      Effect.provide(
        TestDOMSource({
          form: [makeCustomEvent({ username: 99, age: "not-a-number" })],
        }),
      ),
    ),
  )

  it.effect("works end-to-end with validatedEventEffect and TestDOMSource", () =>
    Effect.gen(function* () {
      const form$ = yield* validatedEventEffect("form", "submit", extractDetail, FormDataSchema)

      const result: ReadonlyArray<FormData> = Chunk.toArray(
        yield* form$.pipe(Stream.take(1), Stream.runCollect),
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ username: "charlie", age: 42 })
    }).pipe(
      Effect.provide(
        TestDOMSource({
          form: [makeCustomEvent({ username: "charlie", age: 42 })],
        }),
      ),
    ),
  )

  it.effect("custom extractor can read input element value", () =>
    Effect.gen(function* () {
      const source = yield* DOMSource

      // Extract raw JSON string from a hypothetical data attribute
      const extractJson = (event: Event): unknown => {
        const target = event.target
        if (target instanceof HTMLElement) {
          return target.dataset["payload"]
        }
        return undefined
      }

      const PayloadSchema = Schema.parseJson(
        Schema.Struct({ id: Schema.Number }),
      )

      const button = document.createElement("button")
      button.dataset["payload"] = JSON.stringify({ id: 7 })
      const clickEvent = new MouseEvent("click", { bubbles: true })
      Object.defineProperty(clickEvent, "target", { value: button, writable: false })

      const clicks$ = validatedEvent(source, ".btn", "click", extractJson, PayloadSchema)

      const result = Chunk.toArray(yield* clicks$.pipe(Stream.take(1), Stream.runCollect))

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 7 })
    }).pipe(
      Effect.provide(
        TestDOMSource({
          ".btn": [
            (() => {
              const button = document.createElement("button")
              button.dataset["payload"] = JSON.stringify({ id: 7 })
              const clickEvent = new MouseEvent("click", { bubbles: true })
              Object.defineProperty(clickEvent, "target", { value: button, writable: false })
              return clickEvent
            })(),
          ],
        }),
      ),
    ),
  )
})
