import { Config, Effect, Layer } from "effect"
import { DOMConfig } from "./DOMConfig.js"

/**
 * `DOMConfig` layer that reads from Effect's `Config` system.
 *
 * Reads `DOM_ROOT_SELECTOR` (default `"#app"`) via the active `ConfigProvider`.
 * Missing or invalid configuration becomes a defect via `Effect.orDie`.
 *
 * Use this when the host environment supplies the root selector at runtime
 * (env vars, build-time injection, remote config). For static defaults,
 * prefer `DOMConfigDefault`.
 *
 * @since 0.1.0
 */
export const DOMConfigFromEnv: Layer.Layer<DOMConfig, never> = Layer.effect(
  DOMConfig,
  Effect.gen(function* () {
    const rootSelector = yield* Config.string("DOM_ROOT_SELECTOR").pipe(Config.withDefault("#app"))
    return { rootSelector }
  }).pipe(Effect.orDie),
)
