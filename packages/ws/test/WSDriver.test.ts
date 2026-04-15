import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Queue, Ref, Stream } from "effect"
import { WSError, WSSink, WSSource } from "effect-cycle-ws"

// ---------------------------------------------------------------------------
// WSError unit tests
// ---------------------------------------------------------------------------

describe("WSError", () => {
  it.effect("is catchable via Effect.catchTag", () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail(
        new WSError({ url: "ws://localhost:8080", code: 1006, reason: "Abnormal closure" }),
      ).pipe(Effect.catchTag("WSError", (e) => Effect.succeed(`caught: ${e.url}`)))

      expect(result).toBe("caught: ws://localhost:8080")
    }),
  )

  it("exposes url, code, and reason fields", () => {
    const error = new WSError({ url: "ws://example.com", code: 1001, reason: "Going away" })
    expect(error.url).toBe("ws://example.com")
    expect(error.code).toBe(1001)
    expect(error.reason).toBe("Going away")
    expect(error._tag).toBe("WSError")
  })
})

// ---------------------------------------------------------------------------
// Test WSSource — emits scripted MessageEvents
// ---------------------------------------------------------------------------

const makeMessageEvent = (data: string): MessageEvent => new MessageEvent("message", { data })

const makeTestWSSource = (events: ReadonlyArray<MessageEvent>): WSSource["Type"] => ({
  messages: Stream.fromIterable(events),
  connected: Effect.void,
})

describe("WSSource", () => {
  it.effect("messages stream emits all scripted events", () =>
    Effect.gen(function* () {
      const events = [makeMessageEvent("hello"), makeMessageEvent("world"), makeMessageEvent("!")]

      const source = makeTestWSSource(events)
      const TestWSSourceLayer = Layer.succeed(WSSource, source)

      const result = yield* Effect.gen(function* () {
        const wsSource = yield* WSSource
        return yield* Stream.runCollect(wsSource.messages)
      }).pipe(Effect.provide(TestWSSourceLayer))

      const collected = Array.from(result)
      expect(collected).toHaveLength(3)
      expect(collected[0]?.data).toBe("hello")
      expect(collected[1]?.data).toBe("world")
      expect(collected[2]?.data).toBe("!")
    }),
  )

  it.effect("connected resolves immediately in test layer", () =>
    Effect.gen(function* () {
      const source = makeTestWSSource([])
      const TestWSSourceLayer = Layer.succeed(WSSource, source)

      const result = yield* Effect.gen(function* () {
        const wsSource = yield* WSSource
        yield* wsSource.connected
        return "connected"
      }).pipe(Effect.provide(TestWSSourceLayer))

      expect(result).toBe("connected")
    }),
  )

  it.effect("connected can fail with WSError in test layer", () =>
    Effect.gen(function* () {
      const failingSource: WSSource["Type"] = {
        messages: Stream.empty,
        connected: Effect.fail(new WSError({ url: "ws://localhost:9999", code: 1006 })),
      }

      const TestWSSourceLayer = Layer.succeed(WSSource, failingSource)

      const result = yield* Effect.gen(function* () {
        const wsSource = yield* WSSource
        return yield* wsSource.connected
      }).pipe(
        Effect.catchTag("WSError", (e) => Effect.succeed(`failed: ${e.url}`)),
        Effect.provide(TestWSSourceLayer),
      )

      expect(result).toBe("failed: ws://localhost:9999")
    }),
  )
})

// ---------------------------------------------------------------------------
// Test WSSink — captures sent messages into an array
// ---------------------------------------------------------------------------

// A synchronous test sink that collects items directly (no fiber needed)
const makeSyncTestWSSink = (captured: Ref.Ref<Array<string | ArrayBuffer>>): WSSink["Type"] => ({
  send: (msg$) => Stream.runForEach(msg$, (m) => Ref.update(captured, (arr) => [...arr, m])),
})

describe("WSSink", () => {
  it.effect("send captures string messages from stream", () =>
    Effect.gen(function* () {
      const captured = yield* Ref.make<Array<string | ArrayBuffer>>([])
      const sink = makeSyncTestWSSink(captured)
      const TestWSSinkLayer = Layer.succeed(WSSink, sink)

      yield* Effect.gen(function* () {
        const wsSink = yield* WSSink
        const msg$ = Stream.fromIterable(["ping", "pong", "done"])
        yield* wsSink.send(msg$)
      }).pipe(Effect.provide(TestWSSinkLayer))

      const messages = yield* Ref.get(captured)
      expect(messages).toEqual(["ping", "pong", "done"])
    }),
  )

  it.effect("send handles ArrayBuffer messages", () =>
    Effect.gen(function* () {
      const captured = yield* Ref.make<Array<string | ArrayBuffer>>([])
      const sink = makeSyncTestWSSink(captured)
      const TestWSSinkLayer = Layer.succeed(WSSink, sink)

      const buf = new ArrayBuffer(4)

      yield* Effect.gen(function* () {
        const wsSink = yield* WSSink
        const msg$ = Stream.make(buf)
        yield* wsSink.send(msg$)
      }).pipe(Effect.provide(TestWSSinkLayer))

      const messages = yield* Ref.get(captured)
      expect(messages[0]).toBe(buf)
    }),
  )

  it.effect("send with forked fiber drains async stream via queue", () =>
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<string | ArrayBuffer>()

      // Sink that forwards to a queue (simulates real async send)
      const asyncSink: WSSink["Type"] = {
        send: (msg$) =>
          Effect.gen(function* () {
            yield* Stream.runForEach(msg$, (m) => Queue.offer(queue, m)).pipe(Effect.fork)
          }),
      }

      const TestWSSinkLayer = Layer.succeed(WSSink, asyncSink)

      yield* Effect.gen(function* () {
        const wsSink = yield* WSSink
        const msg$ = Stream.fromIterable(["a", "b", "c"])
        yield* wsSink.send(msg$)
        // Drain 3 items from queue to confirm they arrived
        const first = yield* Queue.take(queue)
        const second = yield* Queue.take(queue)
        const third = yield* Queue.take(queue)
        expect(first).toBe("a")
        expect(second).toBe("b")
        expect(third).toBe("c")
      }).pipe(Effect.provide(TestWSSinkLayer))
    }),
  )
})
