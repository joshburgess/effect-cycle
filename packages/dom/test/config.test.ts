import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"
import { DOMConfig, DOMConfigFromEnv } from "effect-cycle-dom"

describe("DOMConfigFromEnv", () => {
  it.effect("reads DOM_ROOT_SELECTOR from ConfigProvider", () =>
    Effect.gen(function* () {
      const config = yield* DOMConfig
      expect(config.rootSelector).toBe("#root")
    }).pipe(
      Effect.provide(DOMConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(ConfigProvider.fromMap(new Map([["DOM_ROOT_SELECTOR", "#root"]]))),
      ),
    ),
  )

  it.effect("falls back to #app when DOM_ROOT_SELECTOR is unset", () =>
    Effect.gen(function* () {
      const config = yield* DOMConfig
      expect(config.rootSelector).toBe("#app")
    }).pipe(
      Effect.provide(DOMConfigFromEnv),
      Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map()))),
    ),
  )
})
