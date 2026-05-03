/**
 * Entrypoint for the RealWorld (Conduit) example.
 *
 * This example uses HttpClient.HttpClient directly (via FetchHttpClient.layer)
 * rather than effect-cycle-http's HTTPSource/HTTPSink driver. This is
 * intentional: it demonstrates that effect-cycle does not force all HTTP
 * through the driver abstraction. For complex apps with many API endpoints,
 * using HttpClient directly in Effect.gen gives more control over request
 * composition, error recovery, and response parsing than the category-based
 * stream routing that HTTPSource/HTTPSink provides.
 */
import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault } from "effect-cycle-dom"
import { RouterConfigDefault, RouterDriverLive } from "effect-cycle-router"
import { DOMDriverLive } from "effect-cycle-tachys"
import app from "./App.js"

const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)
const routerDrivers = RouterDriverLive.pipe(Layer.provide(RouterConfigDefault))

const drivers = Layer.mergeAll(domDrivers, routerDrivers, FetchHttpClient.layer)

run(app, drivers)
