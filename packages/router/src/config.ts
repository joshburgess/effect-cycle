import { Config, Effect, Layer } from "effect"
import { RouterConfig } from "./RouterConfig.js"

/**
 * `RouterConfig` layer that reads from Effect's `Config` system.
 *
 * Reads `ROUTER_MODE` (default `"hash"`, must be `"hash"` or `"history"`)
 * and `ROUTER_BASE` (default `""`) via the active `ConfigProvider`. Missing
 * or invalid configuration becomes a defect via `Effect.orDie`.
 *
 * Use this when deploy-time settings vary by environment (e.g. `history`
 * mode under a CDN base path in production, `hash` mode locally). For
 * static defaults, prefer `RouterConfigDefault` / `RouterConfigHistory`.
 *
 * @since 0.1.0
 */
export const RouterConfigFromEnv: Layer.Layer<RouterConfig, never> = Layer.effect(
  RouterConfig,
  Effect.gen(function* () {
    const mode = yield* Config.literal(
      "hash",
      "history",
    )("ROUTER_MODE").pipe(Config.withDefault("hash" as const))
    const base = yield* Config.string("ROUTER_BASE").pipe(Config.withDefault(""))
    return { mode, base }
  }).pipe(Effect.orDie),
)
