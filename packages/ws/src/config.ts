import { Config, Effect, Layer } from "effect"
import { WSConfig } from "./WSConfig.js"

/**
 * WSConfig layer that reads from environment Config.
 * Reads WS_URL (required) and optionally WS_PROTOCOLS (comma-separated).
 */
export const WSConfigFromEnv: Layer.Layer<WSConfig, never> = Layer.effect(
  WSConfig,
  Effect.gen(function* () {
    const url = yield* Config.string("WS_URL")
    const protocolsStr = yield* Config.string("WS_PROTOCOLS").pipe(Config.withDefault(""))
    const protocols: ReadonlyArray<string> | undefined = protocolsStr
      ? protocolsStr.split(",").map((s) => s.trim())
      : undefined
    return protocols !== undefined ? { url, protocols } : { url }
  }).pipe(Effect.orDie),
)
