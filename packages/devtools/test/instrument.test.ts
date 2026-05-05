// @vitest-environment jsdom
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Metric, Ref, Stream } from "effect"
import {
  domEventCount,
  httpRequestCount,
  routerNavCount,
  wsMessageCount,
  wsSendCount,
} from "effect-cycle-core"
import {
  DevToolsConfig,
  DevToolsConfigDefault,
  instrumentDOMSource,
  instrumentHTTP,
  instrumentRouter,
  instrumentWS,
} from "effect-cycle-devtools"
import { DOMSource } from "effect-cycle-dom"
import { HTTPSink } from "effect-cycle-http"
import { RouterSource } from "effect-cycle-router"
import {
  TestDOMSource,
  TestHTTPSink,
  TestHTTPSource,
  TestRouterSink,
  TestRouterSource,
  TestWSSink,
  TestWSSource,
} from "effect-cycle-testing"
import { WSSink, WSSource } from "effect-cycle-ws"

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
      const eventsChunk = yield* Stream.runCollect(source.select(".btn", "click"))
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
      const eventsChunk = yield* Stream.runCollect(source.select(".link", "click"))
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

      const { layer: sinkLayer, captured } = yield* TestHTTPSink()
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

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items.length).toBe(1)
      expect(items[0]?.category).toBe("data")

      const after = yield* Metric.value(httpRequestCount)
      expect(after.count).toBeGreaterThan(before.count)
    }),
  )
})

// -------------------------------------------------------------------------------------
// instrumentWS
// -------------------------------------------------------------------------------------

describe("instrumentWS", () => {
  it.effect("wraps WSSource.messages and increments wsMessageCount", () =>
    Effect.gen(function* () {
      const before = yield* Metric.value(wsMessageCount)

      const source = yield* WSSource.pipe(
        Effect.provide(
          Layer.provide(
            instrumentWS,
            Layer.mergeAll(
              TestWSSource([
                new MessageEvent("message", { data: "hello" }),
                new MessageEvent("message", { data: "world" }),
              ]),
              TestWSSink().pipe(
                Effect.map(({ layer }) => layer),
                Layer.unwrapEffect,
              ),
              DevToolsConfigDefault,
            ),
          ),
        ),
      )

      const msgs = yield* Stream.runCollect(source.messages)
      expect(Chunk.size(msgs)).toBe(2)

      const after = yield* Metric.value(wsMessageCount)
      expect(after.count - before.count).toBe(2)
    }),
  )

  it.effect("wraps WSSink.send and increments wsSendCount", () =>
    Effect.gen(function* () {
      const before = yield* Metric.value(wsSendCount)

      const { layer: wsSinkLayer, captured } = yield* TestWSSink()

      const sink = yield* WSSink.pipe(
        Effect.provide(
          Layer.provide(
            instrumentWS,
            Layer.mergeAll(TestWSSource([]), wsSinkLayer, DevToolsConfigDefault),
          ),
        ),
      )

      yield* sink.send(Stream.make("ping", "pong"))
      // TestWSSink forks its subscription (mirroring production WSSink);
      // poll the captured Ref until both messages have been recorded.
      yield* Effect.iterate(0, {
        while: (i) => i < 100,
        body: (i) =>
          Effect.gen(function* () {
            const items = yield* Ref.get(captured)
            if (Chunk.size(items) >= 2) return 100
            yield* Effect.yieldNow()
            return i + 1
          }),
      })

      const items = yield* Ref.get(captured)
      expect(Chunk.size(items)).toBe(2)

      const after = yield* Metric.value(wsSendCount)
      expect(after.count - before.count).toBe(2)
    }),
  )
})

// -------------------------------------------------------------------------------------
// instrumentRouter
// -------------------------------------------------------------------------------------

describe("instrumentRouter", () => {
  it.effect("wraps RouterSource.location$ and increments routerNavCount", () =>
    Effect.gen(function* () {
      const before = yield* Metric.value(routerNavCount)

      const { layer: routerSinkLayer } = yield* TestRouterSink()

      const source = yield* RouterSource.pipe(
        Effect.provide(
          Layer.provide(
            instrumentRouter,
            Layer.mergeAll(
              TestRouterSource([
                { path: "/", query: {}, hash: "" },
                { path: "/about", query: {}, hash: "" },
              ]),
              routerSinkLayer,
              DevToolsConfigDefault,
            ),
          ),
        ),
      )

      const locs = yield* Stream.runCollect(source.location$)
      expect(Chunk.size(locs)).toBe(2)

      const after = yield* Metric.value(routerNavCount)
      expect(after.count - before.count).toBe(2)
    }),
  )
})
