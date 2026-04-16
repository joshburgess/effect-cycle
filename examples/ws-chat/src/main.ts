/**
 * Entrypoint for the ws-chat example.
 *
 * Layer composition:
 *   - DOMConfigDefault   -> provides DOMConfig { rootSelector: "#app" }
 *   - DOMDriverLive      -> requires DOMConfig, provides DOMSource + DOMSink
 *   - WSConfigFromEnv    -> reads WS_URL (required) and WS_PROTOCOLS (optional)
 *                           from ConfigProvider, provides WSConfig
 *   - WSDriverLive       -> requires WSConfig, provides WSSource + WSSink
 *
 * Set WS_URL in the environment or ConfigProvider. Falls back to a default
 * for local development when the env var is not set.
 */
import { ConfigProvider, Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import { WSConfigFromEnv, WSDriverLive } from "effect-cycle-ws"
import app from "./App.js"

// Provide a default WS_URL for local development. In production, set the
// WS_URL environment variable or supply a ConfigProvider with the real URL.
const devDefaults = ConfigProvider.fromMap(new Map([["WS_URL", "ws://localhost:8080"]]))

// WSConfigFromEnv reads WS_URL and WS_PROTOCOLS from the ConfigProvider.
// Layer.setConfigProvider merges our dev defaults underneath the process env.
const wsConfig = WSConfigFromEnv.pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.orElse(ConfigProvider.fromEnv(), () => devDefaults)),
  ),
)

const wsDrivers = WSDriverLive.pipe(Layer.provide(wsConfig))
const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

const drivers = Layer.merge(domDrivers, wsDrivers)

run(app, drivers)
