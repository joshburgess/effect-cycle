/**
 * Entrypoint for the TodoMVC example.
 *
 * Only the DOM driver is needed here — no HTTP or WebSocket.
 * Layer composition follows the same pattern as the counter example.
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import app from "./App.js"

// Provide DOMConfig to the DOM driver, producing a fully self-contained layer.
// Layer.orDie converts initialization errors (e.g. missing "#app" element)
// into defects — these are fatal configuration mistakes, not recoverable errors.
const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

run(app, drivers)
