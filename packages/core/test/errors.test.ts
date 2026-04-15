import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { DriverInitError } from "effect-cycle-core"

describe("DriverInitError", () => {
  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(
        new DriverInitError({ driver: "DOM", cause: "root not found" }),
      ).pipe(Effect.catchTag("DriverInitError", (e) => Effect.succeed(`caught: ${e.driver}`)))

      expect(result).toBe("caught: DOM")
    }),
  )

  it("exposes driver and cause fields", () => {
    const error = new DriverInitError({ driver: "HTTP", cause: new Error("connection refused") })
    expect(error.driver).toBe("HTTP")
    expect(error.cause).toBeInstanceOf(Error)
    expect(error._tag).toBe("DriverInitError")
  })
})
