/**
 * End-to-end smoke test for the TodoMVC example.
 *
 * The app uses native event delegation on `dom.element`, not `dom.select`,
 * so feeding scripted events through TestDOMSource wouldn't reach the
 * handlers. Instead we rely on the initial-render tick (`Stream.concat(
 * Stream.make(undefined), ...)`) to drive at least one VNode through the
 * sink. This still catches the regression we care about: composing the
 * tachys DOMSink with DOMSource and getting the first render to fire.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref } from "effect"
import { DOMSink } from "effect-cycle-tachys"
import { TestDOMSink, TestDOMSource } from "effect-cycle-testing"
import app from "../src/App.js"

describe("todomvc smoke", () => {
  it.effect("composes DOM drivers and renders the initial view", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink(DOMSink)
      const domSourceLayer = TestDOMSource({})

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
