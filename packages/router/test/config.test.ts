import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"
import { RouterConfig, RouterConfigFromEnv } from "effect-cycle-router"

describe("RouterConfigFromEnv", () => {
  it.effect("falls back to hash mode and empty base when env is unset", () =>
    Effect.gen(function* () {
      const config = yield* RouterConfig
      expect(config.mode).toBe("hash")
      expect(config.base).toBe("")
    }).pipe(
      Effect.provide(RouterConfigFromEnv),
      Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map()))),
    ),
  )

  it.effect("reads ROUTER_MODE=history and ROUTER_BASE", () =>
    Effect.gen(function* () {
      const config = yield* RouterConfig
      expect(config.mode).toBe("history")
      expect(config.base).toBe("/app")
    }).pipe(
      Effect.provide(RouterConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["ROUTER_MODE", "history"],
              ["ROUTER_BASE", "/app"],
            ]),
          ),
        ),
      ),
    ),
  )

  it.effect("dies when ROUTER_MODE has an invalid value", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Effect.provide(Effect.void, RouterConfigFromEnv))
      expect(exit._tag).toBe("Failure")
    }).pipe(
      Effect.provide(
        Layer.setConfigProvider(ConfigProvider.fromMap(new Map([["ROUTER_MODE", "browser"]]))),
      ),
    ),
  )
})
