/**
 * End-to-end smoke test for the RealWorld example.
 *
 * Composes every driver the app needs (DOM, Router, HttpClient) under test
 * layers, forks the app, lets the initial render pipeline run, then
 * interrupts. The point is to catch regressions that only show up when
 * multiple driver packages are wired together: missing service requirements,
 * Layer signature drift, broken initial-render paths, etc.
 *
 * The test does NOT exercise specific user flows — it asserts only that the
 * app composes and produces at least one rendered VNode. Deeper assertions
 * would couple the test to the renderApp output structure, which churns.
 */
// @vitest-environment jsdom
import * as HttpClient from "@effect/platform/HttpClient"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref } from "effect"
import { DOMSink } from "effect-cycle-tachys"
import { TestDOMSink, TestDOMSource, TestRouterSink, TestRouterSource } from "effect-cycle-testing"
import app from "../src/App.js"

// Stub HttpClient that never resolves. The app only fetches /api/user at
// boot if `localStorage["conduit-token"]` is set; jsdom's localStorage is
// empty by default so the stub is never invoked. We still have to provide
// it because the app yields HttpClient.HttpClient unconditionally.
const StubHttpClientLive = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make(() => Effect.never),
)

describe("realworld smoke", () => {
  it.effect("composes drivers and renders an initial VNode", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink(DOMSink)
      const domSourceLayer = TestDOMSource({})
      const { layer: routerSinkLayer } = yield* TestRouterSink()
      const routerSourceLayer = TestRouterSource([])

      const layers = Layer.mergeAll(
        domSourceLayer,
        domSinkLayer,
        routerSourceLayer,
        routerSinkLayer,
        StubHttpClientLive,
      )

      const fiber = yield* Effect.fork(app.pipe(Effect.provide(layers)))

      // Poll until the initial render fires, capped so a regression that
      // breaks the render path fails fast instead of hanging the suite.
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
