import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"
import { run } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import { RouterConfigDefault, RouterDriverLive } from "effect-cycle-router"
import app from "./App.js"

const domDrivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)
const routerDrivers = RouterDriverLive.pipe(Layer.provide(RouterConfigDefault))

const drivers = Layer.mergeAll(domDrivers, routerDrivers, FetchHttpClient.layer)

run(app, drivers)
