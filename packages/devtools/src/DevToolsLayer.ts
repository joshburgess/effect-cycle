import { Layer } from "effect"
import type { DOMSink, DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import type { WSSink, WSSource } from "effect-cycle-ws"
import type { DevToolsConfig } from "./DevToolsConfig.js"
import { instrumentDOM } from "./instrumentDOM.js"
import { instrumentHTTP } from "./instrumentHTTP.js"
import { instrumentWS } from "./instrumentWS.js"

/**
 * Combined instrumentation layer for all drivers (DOM, HTTP, WS).
 *
 * Wraps existing driver services with logging, metrics, and spans
 * based on `DevToolsConfig`.
 *
 * @since 0.0.1
 */
export const DevToolsLayer: Layer.Layer<
  DOMSource | DOMSink | HTTPSource | HTTPSink | WSSource | WSSink,
  never,
  DOMSource | DOMSink | HTTPSource | HTTPSink | WSSource | WSSink | DevToolsConfig
> = Layer.mergeAll(instrumentDOM, instrumentHTTP, instrumentWS)
