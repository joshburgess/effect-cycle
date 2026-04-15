import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"
import { WSConfig, WSConfigFromEnv } from "effect-cycle-ws"

// ---------------------------------------------------------------------------
// WSConfigFromEnv tests
// ---------------------------------------------------------------------------

describe("WSConfigFromEnv", () => {
  it.effect("reads WS_URL from ConfigProvider", () =>
    Effect.gen(function* () {
      const config = yield* WSConfig
      expect(config.url).toBe("ws://localhost:4000")
    }).pipe(
      Effect.provide(WSConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(new Map([["WS_URL", "ws://localhost:4000"]])),
        ),
      ),
    ),
  )

  it.effect("sets protocols to undefined when WS_PROTOCOLS is not provided", () =>
    Effect.gen(function* () {
      const config = yield* WSConfig
      expect(config.protocols).toBeUndefined()
    }).pipe(
      Effect.provide(WSConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(new Map([["WS_URL", "ws://localhost:4000"]])),
        ),
      ),
    ),
  )

  it.effect("parses WS_PROTOCOLS as a comma-separated array", () =>
    Effect.gen(function* () {
      const config = yield* WSConfig
      expect(config.protocols).toEqual(["chat", "v2"])
    }).pipe(
      Effect.provide(WSConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["WS_URL", "ws://localhost:4000"],
              ["WS_PROTOCOLS", "chat,v2"],
            ]),
          ),
        ),
      ),
    ),
  )

  it.effect("trims whitespace from protocol entries", () =>
    Effect.gen(function* () {
      const config = yield* WSConfig
      expect(config.protocols).toEqual(["chat", "v2", "v3"])
    }).pipe(
      Effect.provide(WSConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["WS_URL", "ws://localhost:4000"],
              ["WS_PROTOCOLS", "chat, v2 , v3"],
            ]),
          ),
        ),
      ),
    ),
  )

  it.effect("sets protocols to undefined when WS_PROTOCOLS is empty string", () =>
    Effect.gen(function* () {
      const config = yield* WSConfig
      expect(config.protocols).toBeUndefined()
    }).pipe(
      Effect.provide(WSConfigFromEnv),
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["WS_URL", "ws://localhost:4000"],
              ["WS_PROTOCOLS", ""],
            ]),
          ),
        ),
      ),
    ),
  )

  it.effect("dies with a defect when WS_URL is not provided", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Effect.provide(Effect.void, WSConfigFromEnv))
      expect(exit._tag).toBe("Failure")
    }).pipe(Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map())))),
  )
})
