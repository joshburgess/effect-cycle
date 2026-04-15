import { FetchHttpClient } from "@effect/platform"
/**
 * Entrypoint for the http-search example.
 *
 * Layer composition:
 *   - DOMConfigDefault          → provides DOMConfig { rootSelector: "#app" }
 *   - DOMDriverLive             → requires DOMConfig, provides DOMSource + DOMSink
 *   - FetchHttpClient.layer     → provides HttpClient.HttpClient (uses browser fetch)
 *   - HTTPDriverLive            → requires HttpClient, provides HTTPSource + HTTPSink
 *
 * All four are merged into a single `drivers` layer that satisfies the app's requirements.
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import { HTTPDriverLive } from "effect-cycle-http"
import app from "./App.js"

// Wire the DOM driver.
// Layer.orDie converts initialization errors (e.g. missing "#app" element)
// into defects — these are fatal configuration mistakes, not recoverable errors.
const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

// Wire the HTTP driver: provide the fetch-backed HttpClient implementation.
// FetchHttpClient.layer adapts the browser's built-in fetch() to the
// @effect/platform HttpClient interface that HTTPDriverLive requires.
const httpDrivers = HTTPDriverLive.pipe(Layer.provide(FetchHttpClient.layer))

// Merge both driver layers — Layer.merge combines independent layers
// so the result provides DOMSource, DOMSink, HTTPSource, and HTTPSink.
const drivers = Layer.merge(domDrivers, httpDrivers)

run(app, drivers)
