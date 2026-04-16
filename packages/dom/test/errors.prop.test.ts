/**
 * Property-based tests for DOMError.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as fc from "fast-check"
import { DOMError } from "effect-cycle-dom"

describe("DOMError (property-based)", () => {
  const selectorArb = fc.string({ maxLength: 100 })
  const messageArb = fc.string({ maxLength: 200 })

  it("preserves _tag and fields", () => {
    fc.assert(
      fc.property(selectorArb, messageArb, (selector, message) => {
        const err = new DOMError({ selector, message })
        expect(err._tag).toBe("DOMError")
        expect(err.selector).toBe(selector)
        expect(err.message).toBe(message)
      }),
    )
  })

  it("structural equality", () => {
    fc.assert(
      fc.property(selectorArb, messageArb, (selector, message) => {
        const a = new DOMError({ selector, message })
        const b = new DOMError({ selector, message })
        expect(a).toEqual(b)
      }),
    )
  })

  it("is catchable via Effect.catchTag", () => {
    fc.assert(
      fc.property(selectorArb, messageArb, (selector, message) => {
        const eff = Effect.fail(new DOMError({ selector, message })).pipe(
          Effect.catchTag("DOMError", (e) => Effect.succeed(e.selector)),
        )
        expect(Effect.runSync(eff)).toBe(selector)
      }),
    )
  })

  it("caught error retains message field", () => {
    fc.assert(
      fc.property(selectorArb, messageArb, (selector, message) => {
        const eff = Effect.fail(new DOMError({ selector, message })).pipe(
          Effect.catchTag("DOMError", (e) => Effect.succeed(e.message)),
        )
        expect(Effect.runSync(eff)).toBe(message)
      }),
    )
  })
})
