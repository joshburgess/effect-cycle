/**
 * Property-based tests for HTTPError.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { HTTPError } from "effect-cycle-http"
import * as fc from "fast-check"

describe("HTTPError (property-based)", () => {
  const statusArb = fc.integer({ min: 100, max: 599 })
  const bodyArb = fc.string({ maxLength: 200 })
  const urlArb = fc.webUrl()

  it("preserves _tag and fields", () => {
    fc.assert(
      fc.property(statusArb, bodyArb, urlArb, (status, body, url) => {
        const err = new HTTPError({ status, body, url })
        expect(err._tag).toBe("HTTPError")
        expect(err.status).toBe(status)
        expect(err.body).toBe(body)
        expect(err.url).toBe(url)
      }),
    )
  })

  it("structural equality", () => {
    fc.assert(
      fc.property(statusArb, bodyArb, urlArb, (status, body, url) => {
        const a = new HTTPError({ status, body, url })
        const b = new HTTPError({ status, body, url })
        expect(a).toEqual(b)
      }),
    )
  })

  it("is catchable via Effect.catchTag", () => {
    fc.assert(
      fc.property(statusArb, bodyArb, urlArb, (status, body, url) => {
        const eff = Effect.fail(new HTTPError({ status, body, url })).pipe(
          Effect.catchTag("HTTPError", (e) => Effect.succeed(e.status)),
        )
        expect(Effect.runSync(eff)).toBe(status)
      }),
    )
  })
})
