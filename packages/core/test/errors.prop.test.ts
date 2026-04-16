/**
 * Property-based tests for error types across all packages.
 *
 * Verifies that TaggedError instances satisfy structural equality,
 * preserve their _tag, and can be caught with Effect.catchTag.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { DriverInitError } from "effect-cycle-core"
import * as fc from "fast-check"

describe("DriverInitError (property-based)", () => {
  const driverNameArb = fc.string({ minLength: 1, maxLength: 30 })
  const causeArb = fc.oneof(fc.string(), fc.integer(), fc.constant(null))

  it("preserves _tag across all inputs", () => {
    fc.assert(
      fc.property(driverNameArb, causeArb, (driver, cause) => {
        const err = new DriverInitError({ driver, cause })
        expect(err._tag).toBe("DriverInitError")
      }),
    )
  })

  it("preserves constructor fields", () => {
    fc.assert(
      fc.property(driverNameArb, causeArb, (driver, cause) => {
        const err = new DriverInitError({ driver, cause })
        expect(err.driver).toBe(driver)
        expect(err.cause).toBe(cause)
      }),
    )
  })

  it("structural equality: same fields produce equal instances", () => {
    fc.assert(
      fc.property(driverNameArb, fc.string(), (driver, causeStr) => {
        const a = new DriverInitError({ driver, cause: causeStr })
        const b = new DriverInitError({ driver, cause: causeStr })
        // Data.TaggedError uses structural equality
        expect(a).toEqual(b)
      }),
    )
  })

  it("is catchable via Effect.catchTag for all inputs", () => {
    fc.assert(
      fc.property(driverNameArb, causeArb, (driver, cause) => {
        const eff = Effect.fail(new DriverInitError({ driver, cause })).pipe(
          Effect.catchTag("DriverInitError", (e) => Effect.succeed(e.driver)),
        )
        const result = Effect.runSync(eff)
        expect(result).toBe(driver)
      }),
    )
  })
})
