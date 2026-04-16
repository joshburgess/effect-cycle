/**
 * Integration tests that compose test drivers to run real app flows end-to-end.
 *
 * These tests verify that the full source -> transform -> sink pipeline works
 * when wired together through test layers, without touching the browser or network.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpIncomingMessage from "@effect/platform/HttpIncomingMessage"
import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { HTTPSink, HTTPSource } from "effect-cycle-http"
import { WSSink, WSSource } from "effect-cycle-ws"
import {
  TestDOMSink,
  TestDOMSource,
  TestHTTPSink,
  TestHTTPSource,
  TestWSSink,
  TestWSSource,
} from "effect-cycle-testing"

// ---------------------------------------------------------------------------
// Counter app (inline, matching examples/counter/src/App.ts structure)
// ---------------------------------------------------------------------------

const counterApp = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  const count = yield* Ref.make(0)

  const inc$ = dom
    .select(".increment", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n + 1)))

  const dec$ = dom
    .select(".decrement", "click")
    .pipe(Stream.tap(() => Ref.update(count, (n) => n - 1)))

  const vdom$ = Stream.mergeAll([inc$, dec$], { concurrency: "unbounded" }).pipe(
    Stream.mapEffect(() => Ref.get(count)),
    Stream.map((n) => `<div><h1>Count: ${n}</h1></div>`),
  )

  yield* sink.render(vdom$)
})

// ---------------------------------------------------------------------------
// HTTP search app (simplified)
// ---------------------------------------------------------------------------

const httpSearchApp = Effect.gen(function* () {
  const http = yield* HTTPSink
  const httpSource = yield* HTTPSource
  const sink = yield* DOMSink

  const req$ = Stream.make(HttpClientRequest.get("/api/search?q=effect"))
  yield* http.request("search", req$)

  const results$ = httpSource.response("search").pipe(
    Stream.map(() => `<div class="results">Found results</div>`),
    Stream.catchAll(() => Stream.make(`<div class="error">Failed</div>`)),
  )

  yield* sink.render(results$)
})

// ---------------------------------------------------------------------------
// WS chat app (simplified)
// ---------------------------------------------------------------------------

const wsChatApp = Effect.gen(function* () {
  const ws = yield* WSSource
  const wsSink = yield* WSSink
  const sink = yield* DOMSink
  const messages = yield* Ref.make<ReadonlyArray<string>>([])

  yield* ws.connected

  yield* ws.messages.pipe(
    Stream.mapEffect((event) =>
      Ref.update(messages, (msgs) => [...msgs, event.data as string]),
    ),
    Stream.runDrain,
    Effect.fork,
  )

  const outgoing$ = Stream.make("hello", "world")
  yield* wsSink.send(outgoing$)

  // Give the forked fiber a tick to process messages
  yield* Effect.yieldNow()

  const msgs = yield* Ref.get(messages)
  const html = `<div>${msgs.map((m) => `<p>${m}</p>`).join("")}</div>`
  yield* sink.render(Stream.make(html))
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("integration: counter app", () => {
  it.effect("renders after increment clicks", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer, rendered } = yield* TestDOMSink()
      const sourceLayer = TestDOMSource({
        ".increment": [new Event("click"), new Event("click"), new Event("click")],
      })

      yield* counterApp.pipe(Effect.provide(Layer.merge(sourceLayer, sinkLayer)))

      const items = yield* Ref.get(rendered)
      const arr = Chunk.toArray(items)

      // Should have 3 renders (one per click)
      expect(arr).toHaveLength(3)
      // Final render should show count 3
      expect(arr[2]).toContain("Count: 3")
    }),
  )

  it.effect("renders after decrement clicks", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer, rendered } = yield* TestDOMSink()
      const sourceLayer = TestDOMSource({
        ".decrement": [new Event("click"), new Event("click")],
      })

      yield* counterApp.pipe(Effect.provide(Layer.merge(sourceLayer, sinkLayer)))

      const items = yield* Ref.get(rendered)
      const arr = Chunk.toArray(items)

      expect(arr).toHaveLength(2)
      expect(arr[1]).toContain("Count: -2")
    }),
  )

  it.effect("handles mixed inc/dec clicks", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer, rendered } = yield* TestDOMSink()
      const sourceLayer = TestDOMSource({
        ".increment": [new Event("click"), new Event("click")],
        ".decrement": [new Event("click")],
      })

      yield* counterApp.pipe(Effect.provide(Layer.merge(sourceLayer, sinkLayer)))

      const items = yield* Ref.get(rendered)
      const arr = Chunk.toArray(items)

      // 3 total events (2 inc + 1 dec), 3 renders
      expect(arr).toHaveLength(3)
    }),
  )

  it.effect("no events produces no renders", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer, rendered } = yield* TestDOMSink()
      const sourceLayer = TestDOMSource({})

      yield* counterApp.pipe(Effect.provide(Layer.merge(sourceLayer, sinkLayer)))

      const items = yield* Ref.get(rendered)
      expect(Chunk.size(items)).toBe(0)
    }),
  )
})

describe("integration: HTTP search app", () => {
  it.effect("captures outgoing requests and renders responses", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink()
      const domSourceLayer = TestDOMSource({})

      const { layer: httpSinkLayer, captured } = yield* TestHTTPSink()

      // Create a mock response
      const mockResponse = HttpClientResponse.fromWeb(
        HttpClientRequest.get("/api/search?q=effect"),
        new Response(JSON.stringify({ results: ["effect-ts"] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      const httpSourceLayer = TestHTTPSource({ search: [mockResponse] })

      const layers = Layer.mergeAll(domSourceLayer, domSinkLayer, httpSinkLayer, httpSourceLayer)

      yield* httpSearchApp.pipe(Effect.provide(layers))

      // Verify a request was captured
      const reqs = yield* Ref.get(captured)
      expect(Chunk.size(reqs)).toBe(1)
      const req = Chunk.unsafeGet(reqs, 0)
      expect(req.category).toBe("search")

      // Verify response was rendered
      const items = yield* Ref.get(rendered)
      const arr = Chunk.toArray(items)
      expect(arr).toHaveLength(1)
      expect(arr[0]).toContain("Found results")
    }),
  )
})

describe("integration: WS chat app", () => {
  it.effect("sends outgoing messages and renders incoming", () =>
    Effect.gen(function* () {
      const { layer: domSinkLayer, rendered } = yield* TestDOMSink()
      const domSourceLayer = TestDOMSource({})

      const { layer: wsSinkLayer, captured: wsCaptured } = yield* TestWSSink()
      const wsSourceLayer = TestWSSource([
        new MessageEvent("message", { data: "server says hi" }),
        new MessageEvent("message", { data: "server says bye" }),
      ])

      const layers = Layer.mergeAll(domSourceLayer, domSinkLayer, wsSinkLayer, wsSourceLayer)

      yield* wsChatApp.pipe(Effect.provide(layers))

      // Verify outgoing messages were captured
      const sent = yield* Ref.get(wsCaptured)
      const sentArr = Chunk.toArray(sent)
      expect(sentArr).toEqual(["hello", "world"])

      // Verify rendered output includes server messages
      const items = yield* Ref.get(rendered)
      const arr = Chunk.toArray(items)
      expect(arr).toHaveLength(1)
      expect(arr[0]).toContain("server says hi")
      expect(arr[0]).toContain("server says bye")
    }),
  )
})
