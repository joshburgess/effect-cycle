/**
 * Entrypoint for the TodoMVC example.
 *
 * Only the DOM driver is needed here: no HTTP or WebSocket.
 * This example uses the tachys vDOM renderer (`effect-cycle-tachys`)
 * to demonstrate the renderer-agnostic split: `DOMSource` comes from
 * `effect-cycle-dom`, while the renderer-specific `DOMSink` and
 * `DOMDriverLive` come from `effect-cycle-tachys`.
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive } from "effect-cycle-tachys"
import app from "./App.js"

// Provide DOMConfig to the DOM driver, producing a fully self-contained layer.
// Layer.orDie converts initialization errors (e.g. missing "#app" element)
// into defects, since these are fatal configuration mistakes, not recoverable errors.
const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

run(app, drivers)
