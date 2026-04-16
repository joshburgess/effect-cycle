/**
 * Property-based tests for RouterError.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as fc from "fast-check"
import { RouterError } from "effect-cycle-router"

describe("RouterError (property-based)", () => {
  const messageArb = fc.string({ maxLength: 200 })

  it("preserves _tag and fields", () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        const err = new RouterError({ message })
        expect(err._tag).toBe("RouterError")
        expect(err.message).toBe(message)
      }),
    )
  })

  it("structural equality", () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        const a = new RouterError({ message })
        const b = new RouterError({ message })
        expect(a).toEqual(b)
      }),
    )
  })

  it("is catchable via Effect.catchTag", () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        const eff = Effect.fail(new RouterError({ message })).pipe(
          Effect.catchTag("RouterError", (e) => Effect.succeed(e.message)),
        )
        expect(Effect.runSync(eff)).toBe(message)
      }),
    )
  })

  it("caught error retains message field", () => {
    fc.assert(
      fc.property(messageArb, (message) => {
        const eff = Effect.fail(new RouterError({ message })).pipe(
          Effect.catchTag("RouterError", (e) => Effect.succeed(e.message)),
        )
        expect(Effect.runSync(eff)).toBe(message)
      }),
    )
  })
})
