import type { Layer } from "effect"
import {
  type DevToolsBus,
  type DevToolsConfig,
  DevToolsConfigDefault,
  DevToolsLayer,
  instrumentDOM,
  instrumentDOMSink,
  instrumentDOMSource,
  instrumentHTTP,
  instrumentHTTPSink,
  instrumentHTTPSource,
  instrumentRouter,
  instrumentRouterSink,
  instrumentRouterSource,
  instrumentWS,
  instrumentWSSink,
  instrumentWSSource,
} from "effect-cycle-devtools"
import type { DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import { DOMSink } from "effect-cycle-morphdom"
import type { RouterSink, RouterSource } from "effect-cycle-router"
import type { WSSink, WSSource } from "effect-cycle-ws"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// DevToolsConfig
// -------------------------------------------------------------------------------------

describe("DevToolsConfig type", () => {
  it("exposes logLevel, enableMetrics, enableSpans, enableEvents", () => {
    expectTypeOf<DevToolsConfig["Type"]>().toEqualTypeOf<{
      readonly logLevel: "debug" | "info" | "none"
      readonly enableMetrics: boolean
      readonly enableSpans: boolean
      readonly enableEvents: boolean
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
  it("instrumentDOMSource: Layer<DOMSource, never, DOMSource | DevToolsConfig | DevToolsBus>", () => {
    expectTypeOf(instrumentDOMSource).toEqualTypeOf<
      Layer.Layer<DOMSource, never, DOMSource | DevToolsConfig | DevToolsBus>
    >()
  })

  it("instrumentDOMSink(tag): Layer<DOMSink, never, DOMSink | DevToolsConfig | DevToolsBus>", () => {
    expectTypeOf(instrumentDOMSink(DOMSink)).toEqualTypeOf<
      Layer.Layer<DOMSink, never, DOMSink | DevToolsConfig | DevToolsBus>
    >()
  })

  it("instrumentDOM(tag): Layer<DOMSource | DOMSink, never, DOMSource | DOMSink | DevToolsConfig | DevToolsBus>", () => {
    expectTypeOf(instrumentDOM(DOMSink)).toEqualTypeOf<
      Layer.Layer<DOMSource | DOMSink, never, DOMSource | DOMSink | DevToolsConfig | DevToolsBus>
    >()
  })
})

// -------------------------------------------------------------------------------------
// instrumentHTTP / instrumentWS / instrumentRouter
// -------------------------------------------------------------------------------------

describe("driver-specific layers", () => {
  it("instrumentHTTP: Layer<HTTPSource | HTTPSink, ...>", () => {
    expectTypeOf(instrumentHTTP).toEqualTypeOf<
      Layer.Layer<
        HTTPSource | HTTPSink,
        never,
        HTTPSource | HTTPSink | DevToolsConfig | DevToolsBus
      >
    >()
  })

  it("instrumentHTTPSource and instrumentHTTPSink are individually typed", () => {
    expectTypeOf(instrumentHTTPSource).toEqualTypeOf<
      Layer.Layer<HTTPSource, never, HTTPSource | DevToolsConfig | DevToolsBus>
    >()
    expectTypeOf(instrumentHTTPSink).toEqualTypeOf<
      Layer.Layer<HTTPSink, never, HTTPSink | DevToolsConfig | DevToolsBus>
    >()
  })

  it("instrumentWS: Layer<WSSource | WSSink, ...>", () => {
    expectTypeOf(instrumentWS).toEqualTypeOf<
      Layer.Layer<WSSource | WSSink, never, WSSource | WSSink | DevToolsConfig | DevToolsBus>
    >()
  })

  it("instrumentWSSource and instrumentWSSink are individually typed", () => {
    expectTypeOf(instrumentWSSource).toEqualTypeOf<
      Layer.Layer<WSSource, never, WSSource | DevToolsConfig | DevToolsBus>
    >()
    expectTypeOf(instrumentWSSink).toEqualTypeOf<
      Layer.Layer<WSSink, never, WSSink | DevToolsConfig | DevToolsBus>
    >()
  })

  it("instrumentRouter: Layer<RouterSource | RouterSink, ...>", () => {
    expectTypeOf(instrumentRouter).toEqualTypeOf<
      Layer.Layer<
        RouterSource | RouterSink,
        never,
        RouterSource | RouterSink | DevToolsConfig | DevToolsBus
      >
    >()
  })

  it("instrumentRouterSource and instrumentRouterSink are individually typed", () => {
    expectTypeOf(instrumentRouterSource).toEqualTypeOf<
      Layer.Layer<RouterSource, never, RouterSource | DevToolsConfig | DevToolsBus>
    >()
    expectTypeOf(instrumentRouterSink).toEqualTypeOf<
      Layer.Layer<RouterSink, never, RouterSink | DevToolsConfig | DevToolsBus>
    >()
  })
})

// -------------------------------------------------------------------------------------
// DevToolsLayer
// -------------------------------------------------------------------------------------

describe("DevToolsLayer types", () => {
  it("provides every driver service and requires DevToolsConfig + DevToolsBus", () => {
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
      | DevToolsBus
    expectTypeOf(DevToolsLayer(DOMSink)).toEqualTypeOf<Layer.Layer<Provided, never, Required>>()
  })
})
