/**
 * End-to-end smoke test for the ws-chat example.
 *
 * Composes every driver the app needs (DOM, WebSocket) under test layers,
 * forks the app, polls until the captured render Chunk is non-empty (or a
 * generous tick budget runs out), then interrupts. The point is to catch
 * regressions that only show up when multiple driver packages are wired
 * together: the DOMSource/DOMSink renderer pair plus WSSource (with its
 * `connected` gate) plus WSSink.
 *
 * The render trigger here is a single MessageEvent fed through
 * TestWSSource. A bounded poll loop is used instead of a fixed yield count
 * because ws-chat's vdom$ pipes through `Stream.mergeAll` + `mapEffect`,
 * which introduces enough scheduling steps that a small fixed yield budget
 * is fragile.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref } from "effect"
import { DOMSink } from "effect-cycle-tachys"
import { TestDOMSink, TestDOMSource, TestWSSink, TestWSSource } from "effect-cycle-testing"
import app from "../src/App.js"

describe("ws-chat smoke", () => {
  it.effect("composes DOM + WS drivers and renders an initial VNode", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink(DOMSink)
      const domSourceLayer = TestDOMSource({})
      const { layer: wsSinkLayer } = yield* TestWSSink()
      const wsSourceLayer = TestWSSource([new MessageEvent("message", { data: "hi" })])

      const layers = Layer.mergeAll(domSourceLayer, domSinkLayer, wsSourceLayer, wsSinkLayer)

      const fiber = yield* Effect.fork(app.pipe(Effect.provide(layers)))

      // Cap at 500 yields. ws-chat's render pipeline takes ~50 yields under
      // jsdom to settle; 500 is generous headroom without hanging the suite
      // if a regression breaks the render path entirely.
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
