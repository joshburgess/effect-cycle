import { type Context, type Effect, Layer, type Stream } from "effect"
import type { DOMSource } from "effect-cycle-dom"
import type { HTTPSink, HTTPSource } from "effect-cycle-http"
import type { RouterSink, RouterSource } from "effect-cycle-router"
import type { WSSink, WSSource } from "effect-cycle-ws"
import type { DevToolsConfig } from "./DevToolsConfig.js"
import { instrumentDOM } from "./instrumentDOM.js"
import { instrumentHTTP } from "./instrumentHTTP.js"
import { instrumentRouter } from "./instrumentRouter.js"
import { instrumentWS } from "./instrumentWS.js"

type DOMSinkService<V> = {
  readonly render: (vdom$: Stream.Stream<V>) => Effect.Effect<void>
}

/**
 * Combined instrumentation layer for all drivers (DOM, HTTP, WS, Router).
 *
 * Wraps existing driver services with logging, metrics, and spans
 * based on `DevToolsConfig`. The renderer's `DOMSink` Tag is passed in
 * so the layer is bound to that renderer.
 *
 * @example
 * ```ts
 * import { DOMSink } from "effect-cycle-morphdom"
 * const layer = DevToolsLayer(DOMSink)
 * ```
 *
 * @since 0.1.0
 */
export const DevToolsLayer = <Id, V>(
  domSinkTag: Context.Tag<Id, DOMSinkService<V>>,
): Layer.Layer<
  DOMSource | Id | HTTPSource | HTTPSink | WSSource | WSSink | RouterSource | RouterSink,
  never,
  | DOMSource
  | Id
  | HTTPSource
  | HTTPSink
  | WSSource
  | WSSink
  | RouterSource
  | RouterSink
  | DevToolsConfig
> => Layer.mergeAll(instrumentDOM(domSinkTag), instrumentHTTP, instrumentWS, instrumentRouter)
