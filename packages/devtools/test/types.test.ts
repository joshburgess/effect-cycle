import type { Layer } from "effect"
import {
  type DevToolsConfig,
  DevToolsConfigDefault,
  DevToolsLayer,
  instrumentDOM,
  instrumentDOMSink,
  instrumentDOMSource,
  instrumentHTTP,
  instrumentRouter,
  instrumentRouterSink,
  instrumentRouterSource,
  instrumentWS,
} from "effect-cycle-devtools"
import type { DOMSink, DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import type { RouterSink, RouterSource } from "effect-cycle-router"
import type { WSSink, WSSource } from "effect-cycle-ws"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// DevToolsConfig
// -------------------------------------------------------------------------------------

describe("DevToolsConfig type", () => {
  it("exposes logLevel, enableMetrics, enableSpans", () => {
    expectTypeOf<DevToolsConfig["Type"]>().toEqualTypeOf<{
      readonly logLevel: "debug" | "info" | "none"
      readonly enableMetrics: boolean
      readonly enableSpans: boolean
    }>()
  })

  it("DevToolsConfigDefault provides DevToolsConfig", () => {
    expectTypeOf(DevToolsConfigDefault).toMatchTypeOf<Layer.Layer<DevToolsConfig>>()
  })
})

// -------------------------------------------------------------------------------------
// instrumentDOM
// -------------------------------------------------------------------------------------

describe("instrumentDOM types", () => {
  it("instrumentDOMSource: Layer<DOMSource, never, DOMSource | DevToolsConfig>", () => {
    expectTypeOf(instrumentDOMSource).toEqualTypeOf<
      Layer.Layer<DOMSource, never, DOMSource | DevToolsConfig>
    >()
  })

  it("instrumentDOMSink: Layer<DOMSink, never, DOMSink | DevToolsConfig>", () => {
    expectTypeOf(instrumentDOMSink).toEqualTypeOf<
      Layer.Layer<DOMSink, never, DOMSink | DevToolsConfig>
    >()
  })

  it("instrumentDOM: Layer<DOMSource | DOMSink, never, DOMSource | DOMSink | DevToolsConfig>", () => {
    expectTypeOf(instrumentDOM).toEqualTypeOf<
      Layer.Layer<DOMSource | DOMSink, never, DOMSource | DOMSink | DevToolsConfig>
    >()
  })
})

// -------------------------------------------------------------------------------------
// instrumentHTTP / instrumentWS / instrumentRouter
// -------------------------------------------------------------------------------------

describe("driver-specific layers", () => {
  it("instrumentHTTP: Layer<HTTPSource | HTTPSink, ...>", () => {
    expectTypeOf(instrumentHTTP).toEqualTypeOf<
      Layer.Layer<HTTPSource | HTTPSink, never, HTTPSource | HTTPSink | DevToolsConfig>
    >()
  })

  it("instrumentWS: Layer<WSSource | WSSink, ...>", () => {
    expectTypeOf(instrumentWS).toEqualTypeOf<
      Layer.Layer<WSSource | WSSink, never, WSSource | WSSink | DevToolsConfig>
    >()
  })

  it("instrumentRouter: Layer<RouterSource | RouterSink, ...>", () => {
    expectTypeOf(instrumentRouter).toEqualTypeOf<
      Layer.Layer<RouterSource | RouterSink, never, RouterSource | RouterSink | DevToolsConfig>
    >()
  })

  it("instrumentRouterSource and instrumentRouterSink are individually typed", () => {
    expectTypeOf(instrumentRouterSource).toEqualTypeOf<
      Layer.Layer<RouterSource, never, RouterSource | DevToolsConfig>
    >()
    expectTypeOf(instrumentRouterSink).toEqualTypeOf<
      Layer.Layer<RouterSink, never, RouterSink | DevToolsConfig>
    >()
  })
})

// -------------------------------------------------------------------------------------
// DevToolsLayer
// -------------------------------------------------------------------------------------

describe("DevToolsLayer types", () => {
  it("provides every driver service and requires DevToolsConfig", () => {
    type Provided =
      | DOMSource
      | DOMSink
      | HTTPSource
      | HTTPSink
      | WSSource
      | WSSink
      | RouterSource
      | RouterSink
    type Required =
      | DOMSource
      | DOMSink
      | HTTPSource
      | HTTPSink
      | WSSource
      | WSSink
      | RouterSource
      | RouterSink
      | DevToolsConfig
    expectTypeOf(DevToolsLayer).toEqualTypeOf<Layer.Layer<Provided, never, Required>>()
  })
})
