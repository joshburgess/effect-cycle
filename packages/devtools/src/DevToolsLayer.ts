import { Layer } from "effect"
import type { DOMSink, DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import type { WSSink, WSSource } from "effect-cycle-ws"
import type { DevToolsConfig } from "./DevToolsConfig.js"
import { instrumentDOM } from "./instrumentDOM.js"
import { instrumentHTTP } from "./instrumentHTTP.js"
import { instrumentWS } from "./instrumentWS.js"

export const DevToolsLayer: Layer.Layer<
  DOMSource | DOMSink | HTTPSource | HTTPSink | WSSource | WSSink,
  never,
  DOMSource | DOMSink | HTTPSource | HTTPSink | WSSource | WSSink | DevToolsConfig
> = Layer.mergeAll(instrumentDOM, instrumentHTTP, instrumentWS)
