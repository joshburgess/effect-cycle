/**
 * End-to-end smoke test for the counter example.
 *
 * Verifies that the simplest possible app (DOMSource + tachys DOMSink, no
 * other drivers) composes and that a scripted click event drives at least
 * one render. Cheap regression net for the counter renderer's event-to-
 * VNode plumbing.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref } from "effect"
import { DOMSink } from "effect-cycle-tachys"
import { TestDOMSink, TestDOMSource } from "effect-cycle-testing"
import app from "../src/App.js"

describe("counter smoke", () => {
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
