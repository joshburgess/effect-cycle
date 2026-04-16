/**
 * Property-based tests for WSError.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as fc from "fast-check"
import { WSError } from "effect-cycle-ws"

describe("WSError (property-based)", () => {
  const urlArb = fc.webUrl()
  const codeArb = fc.integer({ min: 1000, max: 4999 })
  const reasonArb = fc.string({ maxLength: 100 })

  it("preserves _tag and fields", () => {
    fc.assert(
      fc.property(urlArb, codeArb, reasonArb, (url, code, reason) => {
        const err = new WSError({ url, code, reason })
        expect(err._tag).toBe("WSError")
        expect(err.url).toBe(url)
        expect(err.code).toBe(code)
        expect(err.reason).toBe(reason)
      }),
    )
  })

  it("works with optional fields omitted", () => {
    fc.assert(
      fc.property(urlArb, (url) => {
        const err = new WSError({ url })
        expect(err._tag).toBe("WSError")
        expect(err.url).toBe(url)
        expect(err.code).toBeUndefined()
        expect(err.reason).toBeUndefined()
      }),
    )
  })

  it("structural equality", () => {
    fc.assert(
      fc.property(urlArb, codeArb, reasonArb, (url, code, reason) => {
        const a = new WSError({ url, code, reason })
        const b = new WSError({ url, code, reason })
        expect(a).toEqual(b)
      }),
    )
  })

  it("is catchable via Effect.catchTag", () => {
    fc.assert(
      fc.property(urlArb, (url) => {
        const eff = Effect.fail(new WSError({ url })).pipe(
          Effect.catchTag("WSError", (e) => Effect.succeed(e.url)),
        )
        expect(Effect.runSync(eff)).toBe(url)
      }),
    )
  })
})
