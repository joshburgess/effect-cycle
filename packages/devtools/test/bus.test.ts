// @vitest-environment jsdom
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Ref, Stream } from "effect"
import {
  DevToolsBus,
  DevToolsBusLive,
  DevToolsConfig,
  type DevToolsEvent,
  instrumentDOMSource,
  instrumentHTTP,
  instrumentRouter,
  instrumentWS,
} from "effect-cycle-devtools"
import { DOMSource } from "effect-cycle-dom"
import { HTTPSink } from "effect-cycle-http"
import { RouterSink, RouterSource } from "effect-cycle-router"
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

// All instrumentation features off except event publication, so the
// bus is the only thing exercised.
const eventsOnlyConfig = Layer.succeed(DevToolsConfig, {
  logLevel: "none",
  enableMetrics: false,
  enableSpans: false,
  enableEvents: true,
})

const eventsOffConfig = Layer.succeed(DevToolsConfig, {
  logLevel: "none",
  enableMetrics: false,
  enableSpans: false,
  enableEvents: false,
})

// Subscribes to the bus, runs `body`, and returns the events captured up
// to that point. Subscribes BEFORE running `body` to avoid races.
const collectBusEvents = <A, E, R>(
  body: Effect.Effect<A, E, R>,
): Effect.Effect<readonly DevToolsEvent[], E, R | DevToolsBus> =>
  Effect.gen(function* () {
    const bus = yield* DevToolsBus
    const captured = yield* Ref.make(Chunk.empty<DevToolsEvent>())
    const fiber = yield* Effect.fork(
      Stream.runForEach(bus.events, (event) => Ref.update(captured, Chunk.append(event))),
    )
    // Yield once so the subscriber is registered before we publish.
    yield* Effect.yieldNow()
    yield* body
    // Drain microtasks so taps on the publish path complete.
    yield* Effect.iterate(0, {
      while: (i) => i < 5,
      body: (i) =>
        Effect.gen(function* () {
          yield* Effect.yieldNow()
          return i + 1
        }),
    })
    yield* Fiber.interrupt(fiber)
    return Chunk.toReadonlyArray(yield* Ref.get(captured))
  })

// -------------------------------------------------------------------------------------
// DOM events
// -------------------------------------------------------------------------------------

describe("DevToolsBus: DOM", () => {
  it.effect("publishes DOMEvent when enableEvents is true", () =>
    Effect.gen(function* () {
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const source = yield* DOMSource
          yield* Stream.runDrain(source.select(".btn", "click"))
        }),
      )
      const domEvents = events.filter((e) => e._tag === "DOMEvent")
      expect(domEvents.length).toBe(2)
      for (const event of domEvents) {
        if (event._tag !== "DOMEvent") continue
        expect(event.selector).toBe(".btn")
        expect(event.eventType).toBe("click")
      }
    }).pipe(
      Effect.provide(
        Layer.provideMerge(
          Layer.provide(
            instrumentDOMSource,
            Layer.mergeAll(
              TestDOMSource({ ".btn": [new Event("click"), new Event("click")] }),
              eventsOnlyConfig,
            ),
          ),
          DevToolsBusLive,
        ),
      ),
    ),
  )

  it.effect("publishes nothing when enableEvents is false", () =>
    Effect.gen(function* () {
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const source = yield* DOMSource
          yield* Stream.runDrain(source.select(".btn", "click"))
        }),
      )
      expect(events.length).toBe(0)
    }).pipe(
      Effect.provide(
        Layer.provideMerge(
          Layer.provide(
            instrumentDOMSource,
            Layer.mergeAll(TestDOMSource({ ".btn": [new Event("click")] }), eventsOffConfig),
          ),
          DevToolsBusLive,
        ),
      ),
    ),
  )
})

// -------------------------------------------------------------------------------------
// HTTP events
// -------------------------------------------------------------------------------------

describe("DevToolsBus: HTTP", () => {
  it.effect("publishes HTTPRequest from HTTPSink.request", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer } = yield* TestHTTPSink()
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const sink = yield* HTTPSink
          const req = HttpClientRequest.get("https://example.com/data")
          yield* sink.request("data", Stream.make(req))
        }).pipe(
          Effect.provide(
            Layer.provide(
              instrumentHTTP,
              Layer.mergeAll(TestHTTPSource({}), sinkLayer, eventsOnlyConfig),
            ),
          ),
        ),
      )
      const httpRequests = events.filter((e) => e._tag === "HTTPRequest")
      expect(httpRequests.length).toBe(1)
      const event = httpRequests[0]
      if (event && event._tag === "HTTPRequest") {
        expect(event.category).toBe("data")
        expect(event.url).toBe("https://example.com/data")
      }
    }).pipe(Effect.provide(DevToolsBusLive)),
  )
})

// -------------------------------------------------------------------------------------
// WS events
// -------------------------------------------------------------------------------------

describe("DevToolsBus: WS", () => {
  it.effect("publishes WSMessageReceived from WSSource.messages", () =>
    Effect.gen(function* () {
      const { layer: wsSinkLayer } = yield* TestWSSink()
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const source = yield* WSSource
          yield* Stream.runDrain(source.messages)
        }).pipe(
          Effect.provide(
            Layer.provide(
              instrumentWS,
              Layer.mergeAll(
                TestWSSource([
                  new MessageEvent("message", { data: "hello" }),
                  new MessageEvent("message", { data: "world" }),
                ]),
                wsSinkLayer,
                eventsOnlyConfig,
              ),
            ),
          ),
        ),
      )
      const received = events.filter((e) => e._tag === "WSMessageReceived")
      expect(received.length).toBe(2)
      const previews = received.flatMap((e) =>
        e._tag === "WSMessageReceived" ? [e.dataPreview] : [],
      )
      expect(previews).toEqual(["hello", "world"])
    }).pipe(Effect.provide(DevToolsBusLive)),
  )

  it.effect("publishes WSMessageSent from WSSink.send", () =>
    Effect.gen(function* () {
      const { layer: wsSinkLayer } = yield* TestWSSink()
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const sink = yield* WSSink
          yield* sink.send(Stream.make("ping", "pong"))
        }).pipe(
          Effect.provide(
            Layer.provide(
              instrumentWS,
              Layer.mergeAll(TestWSSource([]), wsSinkLayer, eventsOnlyConfig),
            ),
          ),
        ),
      )
      const sent = events.filter((e) => e._tag === "WSMessageSent")
      expect(sent.length).toBe(2)
      const previews = sent.flatMap((e) => (e._tag === "WSMessageSent" ? [e.dataPreview] : []))
      expect(previews).toEqual(["ping", "pong"])
    }).pipe(Effect.provide(DevToolsBusLive)),
  )
})

// -------------------------------------------------------------------------------------
// Router events
// -------------------------------------------------------------------------------------

describe("DevToolsBus: Router", () => {
  it.effect("publishes RouterNavigation from RouterSource.location$", () =>
    Effect.gen(function* () {
      const { layer: routerSinkLayer } = yield* TestRouterSink()
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const source = yield* RouterSource
          yield* Stream.runDrain(source.location$)
        }).pipe(
          Effect.provide(
            Layer.provide(
              instrumentRouter,
              Layer.mergeAll(
                TestRouterSource([
                  { path: "/", query: {}, hash: "" },
                  { path: "/about", query: {}, hash: "" },
                ]),
                routerSinkLayer,
                eventsOnlyConfig,
              ),
            ),
          ),
        ),
      )
      const navs = events.filter((e) => e._tag === "RouterNavigation")
      expect(navs.length).toBe(2)
      const paths = navs.flatMap((e) => (e._tag === "RouterNavigation" ? [e.path] : []))
      expect(paths).toEqual(["/", "/about"])
    }).pipe(Effect.provide(DevToolsBusLive)),
  )

  it.effect("publishes RouterPush and RouterReplace from RouterSink", () =>
    Effect.gen(function* () {
      const { layer: routerSinkLayer } = yield* TestRouterSink()
      const events = yield* collectBusEvents(
        Effect.gen(function* () {
          const sink = yield* RouterSink
          yield* sink.push("/a")
          yield* sink.replace("/b")
        }).pipe(
          Effect.provide(
            Layer.provide(
              instrumentRouter,
              Layer.mergeAll(TestRouterSource([]), routerSinkLayer, eventsOnlyConfig),
            ),
          ),
        ),
      )
      const pushes = events.filter((e) => e._tag === "RouterPush")
      const replaces = events.filter((e) => e._tag === "RouterReplace")
      expect(pushes.length).toBe(1)
      expect(replaces.length).toBe(1)
      if (pushes[0]?._tag === "RouterPush") expect(pushes[0].path).toBe("/a")
      if (replaces[0]?._tag === "RouterReplace") expect(replaces[0].path).toBe("/b")
    }).pipe(Effect.provide(DevToolsBusLive)),
  )
})
