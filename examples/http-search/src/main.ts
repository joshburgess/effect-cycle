import { FetchHttpClient } from "@effect/platform"
/**
 * Entrypoint for the http-search example.
 *
 * Layer composition:
 *   - DOMConfigDefault          -> provides DOMConfig { rootSelector: "#app" }
 *   - DOMDriverLive             -> requires DOMConfig, provides DOMSource + DOMSink
 *   - FetchHttpClient.layer     -> provides HttpClient.HttpClient (uses browser fetch)
 *   - HTTPDriverConfigured      -> reads HTTP_BASE_URL, HTTP_TIMEOUT_MS, HTTP_RETRIES
 *                                  from ConfigProvider, applies them to the HttpClient,
 *                                  and provides HTTPSource + HTTPSink
 *
 * All are merged into a single `drivers` layer that satisfies the app's requirements.
 */
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault } from "effect-cycle-dom"
import { HTTPDriverConfigured } from "effect-cycle-http"
import { DOMDriverLive } from "effect-cycle-tachys"
import app from "./App.js"

const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

// HTTPDriverConfigured reads config (base URL, timeout, retries) from
// ConfigProvider and applies them to the HttpClient before wiring the driver.
// Falls back to sensible defaults when env vars are not set.
const httpDrivers = HTTPDriverConfigured.pipe(Layer.provide(FetchHttpClient.layer))

const drivers = Layer.merge(domDrivers, httpDrivers)

run(app, drivers)
