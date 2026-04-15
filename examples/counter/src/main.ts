/**
 * Entrypoint for the counter example.
 *
 * `run(app, drivers)` wires the driver layer into the app Effect and forks it.
 * The driver layer is built by composing:
 *   - DOMDriverLive: provides DOMSource + DOMSink, requires DOMConfig
 *   - DOMConfigDefault: provides DOMConfig with rootSelector "#app"
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import app from "./App.js"

// Layer.provide threads DOMConfigDefault into DOMDriverLive so the result
// is a self-contained layer requiring no further dependencies.
// Layer.orDie converts any initialization errors (e.g. missing root element)
// into defects — they are fatal configuration mistakes, not recoverable errors.
const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

// run() provides the driver layer to app and forks it on the global runtime.
// The returned fiber can be interrupted to cleanly shut down the app.
run(app, drivers)
