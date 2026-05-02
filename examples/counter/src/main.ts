/// <reference types="vite/client" />
import { Layer } from "effect"
import { installHmr } from "effect-cycle-core"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import app from "./App.js"

const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

installHmr(drivers, app, import.meta.hot)
