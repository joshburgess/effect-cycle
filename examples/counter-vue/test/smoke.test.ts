/**
 * End-to-end smoke test for the counter-vue example.
 *
 * Same shape as examples/counter/test/smoke.test.ts but pulling DOMSink
 * from effect-cycle-vue. Catches Vue-specific Sink wiring regressions.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref } from "effect"
import { TestDOMSink, TestDOMSource } from "effect-cycle-testing"
import { DOMSink } from "effect-cycle-vue"
import app from "../src/App.js"

describe("counter-vue smoke", () => {
  it.effect("composes DOM drivers and renders after a click", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink(DOMSink)
      const domSourceLayer = TestDOMSource({ ".increment": [new Event("click")] })

      const layers = Layer.mergeAll(domSourceLayer, domSinkLayer)
      const fiber = yield* Effect.fork(app.pipe(Effect.provide(layers)))

      const MAX_YIELDS = 500
      let ticks = 0
      while (ticks < MAX_YIELDS) {
        const items = yield* Ref.get(rendered)
        if (Chunk.size(items) >= 1) break
        yield* Effect.yieldNow()
        ticks += 1
      }

      yield* Fiber.interrupt(fiber)

      const items = yield* Ref.get(rendered)
      expect(Chunk.size(items)).toBeGreaterThanOrEqual(1)
    }),
  )
})
