import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { HTTPSink, HTTPSource } from "effect-cycle-http"
import {
  TestDOMSink,
  TestDOMSource,
  TestHTTPSink,
  TestHTTPSource,
  TestWSSink,
  TestWSSource,
  runTest,
} from "effect-cycle-testing"
import { WSSink, WSSource } from "effect-cycle-ws"

// ---------------------------------------------------------------------------
// TestDOMSource
// ---------------------------------------------------------------------------

describe("TestDOMSource", () => {
  it.effect("emits scripted events for the correct selector", () =>
    Effect.gen(function* () {
      const clickEvent = yield* Effect.sync(() => new Event("click"))
      const layer = TestDOMSource({ ".btn": [clickEvent] })

      const source = yield* DOMSource.pipe(Effect.provide(layer))
      const eventsChunk = yield* Stream.runCollect(source.select(".btn", "click"))
      const events = Chunk.toArray(eventsChunk)

      expect(events.length).toBe(1)
      expect(events[0]).toBe(clickEvent)
    }),
  )

  it.effect("emits empty stream for unknown selector", () =>
    Effect.gen(function* () {
      const layer = TestDOMSource({})

      const source = yield* DOMSource.pipe(Effect.provide(layer))
      const eventsChunk = yield* Stream.runCollect(source.select(".unknown", "click"))
      const events = Chunk.toArray(eventsChunk)

      expect(events.length).toBe(0)
    }),
  )

  it.effect("element returns a div element", () =>
    Effect.gen(function* () {
      const layer = TestDOMSource({})

      const source = yield* DOMSource.pipe(Effect.provide(layer))
      const el = yield* source.element

      expect(el.tagName.toLowerCase()).toBe("div")
    }),
  )
})

// ---------------------------------------------------------------------------
// TestDOMSink
// ---------------------------------------------------------------------------

describe("TestDOMSink", () => {
  it.effect("captures rendered VNodes in order", () =>
    Effect.gen(function* () {
      const { layer, rendered } = yield* TestDOMSink()

      const sink = yield* DOMSink.pipe(Effect.provide(layer))
      yield* sink.render(Stream.make("<p>hello</p>", "<p>world</p>"))

      const items = Chunk.toReadonlyArray(yield* Ref.get(rendered))
      expect(items).toEqual(["<p>hello</p>", "<p>world</p>"])
    }),
  )

  it.effect("starts with an empty rendered chunk", () =>
    Effect.gen(function* () {
      const { layer, rendered } = yield* TestDOMSink()

      yield* DOMSink.pipe(Effect.provide(layer))

      const items = Chunk.toReadonlyArray(yield* Ref.get(rendered))
      expect(items).toEqual([])
    }),
  )
})

// ---------------------------------------------------------------------------
// TestHTTPSource
// ---------------------------------------------------------------------------

describe("TestHTTPSource", () => {
  it.effect("emits scripted responses for the correct category", () =>
    Effect.gen(function* () {
      const mockRequest = HttpClientRequest.get("https://example.com/users")
      const mockResponse = HttpClientResponse.fromWeb(
        mockRequest,
        new Response(JSON.stringify({ id: 1 }), { status: 200 }),
      )

      const layer = TestHTTPSource({ users: [mockResponse] })

      const source = yield* HTTPSource.pipe(Effect.provide(layer))
      const responsesChunk = yield* Stream.runCollect(source.response("users"))
      const responses = Chunk.toArray(responsesChunk)

      expect(responses.length).toBe(1)
      expect(responses[0]?.status).toBe(200)
    }),
  )

  it.effect("emits empty stream for unknown category", () =>
    Effect.gen(function* () {
      const layer = TestHTTPSource({})

      const source = yield* HTTPSource.pipe(Effect.provide(layer))
      const responsesChunk = yield* Stream.runCollect(source.response("missing"))
      const responses = Chunk.toArray(responsesChunk)

      expect(responses.length).toBe(0)
    }),
  )
})

// ---------------------------------------------------------------------------
// TestHTTPSink
// ---------------------------------------------------------------------------

describe("TestHTTPSink", () => {
  it.effect("captures requests with correct categories", () =>
    Effect.gen(function* () {
      const { layer, captured } = yield* TestHTTPSink()

      const usersReq = HttpClientRequest.get("https://example.com/users")
      const postsReq = HttpClientRequest.get("https://example.com/posts")

      const sink = yield* HTTPSink.pipe(Effect.provide(layer))
      yield* sink.request("users", Stream.make(usersReq))
      yield* sink.request("posts", Stream.make(postsReq))

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items.length).toBe(2)
      expect(items[0]?.category).toBe("users")
      expect(items[0]?.request.url).toBe("https://example.com/users")
      expect(items[1]?.category).toBe("posts")
      expect(items[1]?.request.url).toBe("https://example.com/posts")
    }),
  )

  it.effect("starts with an empty captured chunk", () =>
    Effect.gen(function* () {
      const { layer, captured } = yield* TestHTTPSink()

      yield* HTTPSink.pipe(Effect.provide(layer))

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items).toEqual([])
    }),
  )
})

// ---------------------------------------------------------------------------
// TestWSSource
// ---------------------------------------------------------------------------

describe("TestWSSource", () => {
  it.effect("emits scripted messages", () =>
    Effect.gen(function* () {
      const msg1 = yield* Effect.sync(() => new MessageEvent("message", { data: "hello" }))
      const msg2 = yield* Effect.sync(() => new MessageEvent("message", { data: "world" }))
      const layer = TestWSSource([msg1, msg2])

      const source = yield* WSSource.pipe(Effect.provide(layer))
      const messagesChunk = yield* Stream.runCollect(source.messages)
      const messages = Chunk.toArray(messagesChunk)

      expect(messages.length).toBe(2)
      expect(messages[0]).toBe(msg1)
      expect(messages[1]).toBe(msg2)
    }),
  )

  it.effect("connected resolves immediately", () =>
    Effect.gen(function* () {
      const layer = TestWSSource([])

      const source = yield* WSSource.pipe(Effect.provide(layer))
      yield* source.connected

      expect(true).toBe(true)
    }),
  )

  it.effect("emits empty stream when no events provided", () =>
    Effect.gen(function* () {
      const layer = TestWSSource([])

      const source = yield* WSSource.pipe(Effect.provide(layer))
      const messagesChunk = yield* Stream.runCollect(source.messages)
      const messages = Chunk.toArray(messagesChunk)

      expect(messages.length).toBe(0)
    }),
  )
})

// ---------------------------------------------------------------------------
// TestWSSink
// ---------------------------------------------------------------------------

describe("TestWSSink", () => {
  it.effect("captures sent messages", () =>
    Effect.gen(function* () {
      const { layer, captured } = yield* TestWSSink()

      const sink = yield* WSSink.pipe(Effect.provide(layer))
      yield* sink.send(Stream.make("hello", "world"))

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items).toEqual(["hello", "world"])
    }),
  )

  it.effect("captures ArrayBuffer messages", () =>
    Effect.gen(function* () {
      const { layer, captured } = yield* TestWSSink()
      const buf = yield* Effect.sync(() => new ArrayBuffer(4))

      const sink = yield* WSSink.pipe(Effect.provide(layer))
      yield* sink.send(Stream.make(buf))

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items.length).toBe(1)
      expect(items[0]).toBe(buf)
    }),
  )

  it.effect("starts with an empty captured chunk", () =>
    Effect.gen(function* () {
      const { layer, captured } = yield* TestWSSink()

      yield* WSSink.pipe(Effect.provide(layer))

      const items = Chunk.toReadonlyArray(yield* Ref.get(captured))
      expect(items).toEqual([])
    }),
  )
})

// ---------------------------------------------------------------------------
// runTest
// ---------------------------------------------------------------------------

describe("runTest", () => {
  it("executes an app with test layers", async () => {
    const results: Array<string> = []

    const app = Effect.gen(function* () {
      const source = yield* DOMSource
      const events = yield* Stream.runCollect(source.select(".btn", "click"))
      yield* Effect.sync(() => results.push(`events:${events.length}`))
    })

    const clickEvent = new Event("click")
    const layers = TestDOMSource({ ".btn": [clickEvent] })

    await runTest(app, layers)

    expect(results).toEqual(["events:1"])
  })

  it("works with merged layers", async () => {
    const results: Array<string> = []

    const app = Effect.gen(function* () {
      const source = yield* DOMSource
      const sink = yield* DOMSink
      const events = yield* Stream.runCollect(source.select(".btn", "click"))
      yield* sink.render(Stream.make(`<p>count:${events.length}</p>`))
      yield* Effect.sync(() => results.push("done"))
    })

    const clickEvent = new Event("click")
    const { layer: sinkLayer, rendered } = await Effect.runPromise(TestDOMSink())
    const sourceLayer = TestDOMSource({ ".btn": [clickEvent] })
    const layers = Layer.merge(sourceLayer, sinkLayer)

    await runTest(app, layers)

    expect(results).toEqual(["done"])
    const items = Chunk.toReadonlyArray(await Effect.runPromise(Ref.get(rendered)))
    expect(items).toEqual(["<p>count:1</p>"])
  })
})
