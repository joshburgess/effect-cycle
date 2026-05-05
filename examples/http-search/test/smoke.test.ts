/**
 * End-to-end smoke test for the http-search example.
 *
 * Composes DOM + HTTP test drivers, drives a single keyup event through the
 * search input, then feeds a stub HttpClientResponse back via TestHTTPSource
 * keyed by the "search" category. Asserts that the response branch produces
 * at least one rendered VNode.
 *
 * The app debounces keyup -> request by 300ms, so we use TestClock to
 * fast-forward past the debounce window rather than waiting in real time.
 */
// @vitest-environment jsdom
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref, TestClock } from "effect"
import { DOMSink } from "effect-cycle-tachys"
import { TestDOMSink, TestDOMSource, TestHTTPSink, TestHTTPSource } from "effect-cycle-testing"
import app from "../src/App.js"

describe("http-search smoke", () => {
  it.effect("composes DOM + HTTP drivers and renders the response branch", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink(DOMSink)

      // The keyup target needs a `.value` property; jsdom's plain `Event`
      // works because Stream.mapEffect reads `event.target.value` from a
      // freshly attached input. We stub it with a constructed input element
      // wrapped in a custom Event so `event.target` resolves.
      const input = document.createElement("input")
      input.value = "effect"
      const keyEvent = new Event("keyup")
      Object.defineProperty(keyEvent, "target", { value: input })

      const domSourceLayer = TestDOMSource({ ".search-input": [keyEvent] })

      const { layer: httpSinkLayer } = yield* TestHTTPSink()
      const mockResponse = HttpClientResponse.fromWeb(
        HttpClientRequest.get("/api/search?q=effect"),
        new Response("<li>result</li>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      const httpSourceLayer = TestHTTPSource({ search: [mockResponse] })

      const layers = Layer.mergeAll(domSourceLayer, domSinkLayer, httpSinkLayer, httpSourceLayer)

      const fiber = yield* Effect.fork(app.pipe(Effect.provide(layers)))

      // Advance past the 300ms debounce so the request stream emits.
      yield* TestClock.adjust("400 millis")

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
