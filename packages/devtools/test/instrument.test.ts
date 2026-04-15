// @vitest-environment jsdom
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Metric, Stream } from "effect"
import { domEventCount, httpRequestCount } from "effect-cycle-core"
import {
  DevToolsConfig,
  DevToolsConfigDefault,
  instrumentDOMSource,
  instrumentHTTP,
} from "effect-cycle-devtools"
import { DOMSource } from "effect-cycle-dom"
import { HTTPSink } from "effect-cycle-http"
import { TestDOMSource, TestHTTPSink, TestHTTPSource } from "effect-cycle-testing"

// -------------------------------------------------------------------------------------
// DevToolsConfigDefault
// -------------------------------------------------------------------------------------

describe("DevToolsConfigDefault", () => {
  it.effect("provides sensible defaults", () =>
    Effect.gen(function* () {
      const config = yield* DevToolsConfig
      expect(config.logLevel).toBe("info")
      expect(config.enableMetrics).toBe(true)
      expect(config.enableSpans).toBe(true)
    }).pipe(Effect.provide(DevToolsConfigDefault)),
  )
})

// -------------------------------------------------------------------------------------
// instrumentDOMSource
// -------------------------------------------------------------------------------------

describe("instrumentDOMSource", () => {
  it.effect("wraps select and increments domEventCount", () =>
    Effect.gen(function* () {
      const before = yield* Metric.value(domEventCount)

      const source = yield* DOMSource
      const eventsChunk = yield* Stream.runCollect(source.select(".btn"))
      const events = Chunk.toArray(eventsChunk)

      expect(events.length).toBe(1)

      const after = yield* Metric.value(domEventCount)
      expect(after.count).toBeGreaterThan(before.count)
    }).pipe(
      Effect.provide(
        Layer.provide(
          instrumentDOMSource,
          Layer.merge(TestDOMSource({ ".btn": [new Event("click")] }), DevToolsConfigDefault),
        ),
      ),
    ),
  )

  it.effect("passes through events when metrics and logging disabled", () =>
    Effect.gen(function* () {
      const source = yield* DOMSource
      const eventsChunk = yield* Stream.runCollect(source.select(".link"))
      const events = Chunk.toArray(eventsChunk)
      expect(events.length).toBe(2)
    }).pipe(
      Effect.provide(
        Layer.provide(
          instrumentDOMSource,
          Layer.merge(
            TestDOMSource({ ".link": [new Event("click"), new Event("click")] }),
            Layer.succeed(DevToolsConfig, {
              logLevel: "none",
              enableMetrics: false,
              enableSpans: false,
            }),
          ),
        ),
      ),
    ),
  )
})

// -------------------------------------------------------------------------------------
// instrumentHTTP
// -------------------------------------------------------------------------------------

describe("instrumentHTTP", () => {
  it.effect("wraps HTTPSink.request and increments httpRequestCount", () =>
    Effect.gen(function* () {
      const before = yield* Metric.value(httpRequestCount)

      const { layer: sinkLayer, captured } = TestHTTPSink()
      const sourceLayer = TestHTTPSource({})

      const sink = yield* HTTPSink.pipe(
        Effect.provide(
          Layer.provide(
            instrumentHTTP,
            Layer.mergeAll(sourceLayer, sinkLayer, DevToolsConfigDefault),
          ),
        ),
      )

      const req = HttpClientRequest.get("https://example.com/data")
      yield* sink.request("data", Stream.make(req))

      expect(captured.length).toBe(1)
      expect(captured[0]?.category).toBe("data")

      const after = yield* Metric.value(httpRequestCount)
      expect(after.count).toBeGreaterThan(before.count)
    }),
  )
})
