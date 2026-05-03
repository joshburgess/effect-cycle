/// <reference types="vite/client" />
import { Layer } from "effect"
import { installHmr } from "effect-cycle-core"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive } from "effect-cycle-vue"
import app from "./App.js"

const drivers = DOMDriverLive.pipe(Layer.provide(DOMConfigDefault), Layer.orDie)

installHmr(drivers, app, import.meta.hot)
