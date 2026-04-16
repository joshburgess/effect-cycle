import { Layer } from "effect"
import type { DOMSink, DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import type { RouterSink, RouterSource } from "effect-cycle-router"
import type { WSSink, WSSource } from "effect-cycle-ws"
import type { DevToolsConfig } from "./DevToolsConfig.js"
import { instrumentDOM } from "./instrumentDOM.js"
import { instrumentHTTP } from "./instrumentHTTP.js"
import { instrumentRouter } from "./instrumentRouter.js"
import { instrumentWS } from "./instrumentWS.js"

/**
 * Combined instrumentation layer for all drivers (DOM, HTTP, WS, Router).
 *
 * Wraps existing driver services with logging, metrics, and spans
 * based on `DevToolsConfig`.
 *
 * @since 0.1.0
 */
export const DevToolsLayer: Layer.Layer<
  DOMSource | DOMSink | HTTPSource | HTTPSink | WSSource | WSSink | RouterSource | RouterSink,
  never,
  | DOMSource
  | DOMSink
  | HTTPSource
  | HTTPSink
  | WSSource
  | WSSink
  | RouterSource
  | RouterSink
  | DevToolsConfig
> = Layer.mergeAll(instrumentDOM, instrumentHTTP, instrumentWS, instrumentRouter)
