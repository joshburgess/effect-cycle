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
 *
 * DOMConfigFromEnv and RouterConfigFromEnv read driver settings from the
 * active ConfigProvider so deploy-time values can override the dev defaults
 * baked in below (e.g. mounting under a different selector, switching the
 * router to history mode under a CDN base path).
 */
import { FetchHttpClient } from "@effect/platform"
import { ConfigProvider, Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigFromEnv } from "effect-cycle-dom"
import { RouterConfigFromEnv, RouterDriverLive } from "effect-cycle-router"
import { DOMDriverLive } from "effect-cycle-tachys"
import app from "./App.js"

// Dev defaults stack underneath the process env, so any var the host
// exports wins; everything else falls back to these values.
const devDefaults = ConfigProvider.fromMap(
  new Map([
    ["DOM_ROOT_SELECTOR", "#app"],
    ["ROUTER_MODE", "hash"],
    ["ROUTER_BASE", ""],
  ]),
)

const configLayer = Layer.setConfigProvider(
  ConfigProvider.orElse(ConfigProvider.fromEnv(), () => devDefaults),
)

const domConfig = DOMConfigFromEnv.pipe(Layer.provide(configLayer))
const routerConfig = RouterConfigFromEnv.pipe(Layer.provide(configLayer))

const domDrivers = DOMDriverLive.pipe(Layer.provide(domConfig), Layer.orDie)
const routerDrivers = RouterDriverLive.pipe(Layer.provide(routerConfig))

const drivers = Layer.mergeAll(domDrivers, routerDrivers, FetchHttpClient.layer)

run(app, drivers)
