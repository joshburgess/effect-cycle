/**
 * Entrypoint for the ws-chat example.
 *
 * Layer composition:
 *   - DOMConfigDefault   → provides DOMConfig { rootSelector: "#app" }
 *   - DOMDriverLive      → requires DOMConfig, provides DOMSource + DOMSink
 *   - WSConfig layer     → provides WSConfig { url: "ws://localhost:8080" }
 *   - WSDriverLive       → requires WSConfig, provides WSSource + WSSink
 *
 * In a real app the WebSocket URL would come from an environment variable
 * or configuration file; here we supply it inline with Layer.succeed.
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import { WSConfig, WSDriverLive } from "effect-cycle-ws"
import app from "./App.js"

// Layer.succeed constructs a layer that directly provides a service value
// without any initialization effects.  Ideal for plain configuration objects.
const wsConfig = Layer.succeed(WSConfig, { url: "ws://localhost:8080" })

// Provide the config layer to the WebSocket driver.
const wsDrivers = WSDriverLive.pipe(Layer.provide(wsConfig))

// Provide the config layer to the DOM driver.
// Layer.orDie converts initialization errors (e.g. missing "#app" element)
// into defects — these are fatal configuration mistakes, not recoverable errors.
const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

// Merge the two independent driver layers into one.
const drivers = Layer.merge(domDrivers, wsDrivers)

run(app, drivers)
