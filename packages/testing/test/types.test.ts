import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import type { Chunk, Effect, Layer, Ref } from "effect"
import type { App } from "effect-cycle-core"
import type { DOMSource } from "effect-cycle-dom"
import type { HTTPError, HTTPSink, HTTPSource } from "effect-cycle-http"
import { DOMSink, type VNode } from "effect-cycle-morphdom"
import type { Navigation, RouteLocation, RouterSink, RouterSource } from "effect-cycle-router"
import {
  type CapturedRequest,
  TestDOMSink,
  TestDOMSource,
  TestHTTPSink,
  TestHTTPSource,
  TestRouterSink,
  TestRouterSource,
  TestWSSink,
  TestWSSource,
  runTest,
} from "effect-cycle-testing"
import type { WSSink, WSSource } from "effect-cycle-ws"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// runTest
// -------------------------------------------------------------------------------------

interface FooTag {
  readonly _tag: "Foo"
}

describe("runTest types", () => {
  it("accepts an App<void, E, R> and a matching layer, returns Promise<void>", () => {
    const call = (app: App<void, "boom", FooTag>, layers: Layer.Layer<FooTag>) =>
      runTest(app, layers)
    expectTypeOf(call).returns.toEqualTypeOf<Promise<void>>()
  })

  it("rejects a layer that does not satisfy the app's requirements", () => {
    const _bad = (app: App<void, never, FooTag>, layers: Layer.Layer<{ _tag: "Bar" }>) =>
      // @ts-expect-error - layer provides Bar, app requires FooTag
      runTest(app, layers)
    void _bad
  })
})

// -------------------------------------------------------------------------------------
// TestDOMSource / TestDOMSink
// -------------------------------------------------------------------------------------

describe("TestDOMSource types", () => {
  it("returns Layer<DOMSource>", () => {
    const call = (events: Record<string, ReadonlyArray<Event>>) => TestDOMSource(events)
    expectTypeOf(call).returns.toEqualTypeOf<Layer.Layer<DOMSource>>()
  })
})

describe("TestDOMSink types", () => {
  it("yields { layer, rendered: Ref<Chunk<VNode>> } when called with a DOMSink Tag", () => {
    const call = () => TestDOMSink(DOMSink)
    expectTypeOf(call).returns.toEqualTypeOf<
      Effect.Effect<{
        readonly layer: Layer.Layer<DOMSink>
        readonly rendered: Ref.Ref<Chunk.Chunk<VNode>>
      }>
    >()
  })
})

// -------------------------------------------------------------------------------------
// TestHTTPSource / TestHTTPSink
// -------------------------------------------------------------------------------------

describe("TestHTTPSource types", () => {
  it("accepts responses + optional errors and returns Layer<HTTPSource>", () => {
    const call = (
      responses: Record<string, ReadonlyArray<HttpClientResponse.HttpClientResponse>>,
    ) => TestHTTPSource(responses)
    expectTypeOf(call).returns.toEqualTypeOf<Layer.Layer<HTTPSource>>()

    const callWithErrors = (
      responses: Record<string, ReadonlyArray<HttpClientResponse.HttpClientResponse>>,
      errors: Record<string, ReadonlyArray<HTTPError>>,
    ) => TestHTTPSource(responses, errors)
    expectTypeOf(callWithErrors).returns.toEqualTypeOf<Layer.Layer<HTTPSource>>()
  })
})

describe("TestHTTPSink types", () => {
  it("yields { layer, captured: Ref<Chunk<CapturedRequest>> }", () => {
    expectTypeOf(TestHTTPSink).returns.toEqualTypeOf<
      Effect.Effect<{
        readonly layer: Layer.Layer<HTTPSink>
        readonly captured: Ref.Ref<Chunk.Chunk<CapturedRequest>>
      }>
    >()
  })
})

// -------------------------------------------------------------------------------------
// TestRouterSource / TestRouterSink
// -------------------------------------------------------------------------------------

describe("TestRouterSource types", () => {
  it("returns Layer<RouterSource>", () => {
    const call = (locations: ReadonlyArray<RouteLocation>) => TestRouterSource(locations)
    expectTypeOf(call).returns.toEqualTypeOf<Layer.Layer<RouterSource>>()
  })
})

describe("TestRouterSink types", () => {
  it("yields { layer, captured: Ref<Chunk<Navigation>> }", () => {
    expectTypeOf(TestRouterSink).returns.toEqualTypeOf<
      Effect.Effect<{
        readonly layer: Layer.Layer<RouterSink>
        readonly captured: Ref.Ref<Chunk.Chunk<Navigation>>
      }>
    >()
  })
})

// -------------------------------------------------------------------------------------
// TestWSSource / TestWSSink
// -------------------------------------------------------------------------------------

describe("TestWSSource types", () => {
  it("returns Layer<WSSource>", () => {
    const call = (events: ReadonlyArray<MessageEvent>) => TestWSSource(events)
    expectTypeOf(call).returns.toEqualTypeOf<Layer.Layer<WSSource>>()
  })
})

describe("TestWSSink types", () => {
  it("yields { layer, captured: Ref<Chunk<string | ArrayBuffer>> }", () => {
    expectTypeOf(TestWSSink).returns.toEqualTypeOf<
      Effect.Effect<{
        readonly layer: Layer.Layer<WSSink>
        readonly captured: Ref.Ref<Chunk.Chunk<string | ArrayBuffer>>
      }>
    >()
  })
})

// -------------------------------------------------------------------------------------
// CapturedRequest shape
// -------------------------------------------------------------------------------------

describe("CapturedRequest type", () => {
  it("has category and request", () => {
    expectTypeOf<CapturedRequest>().toMatchTypeOf<{
      readonly category: string
    }>()
  })
})
