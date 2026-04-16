import { Context, Layer } from "effect"

/**
 * Shape of the router configuration.
 *
 * @since 0.0.1
 */
export interface RouterConfigShape {
  /** `"hash"` uses `window.location.hash`; `"history"` uses the History API. */
  readonly mode: "hash" | "history"
  /** Base path prefix stripped from all routes. Default: `""`. */
  readonly base: string
}

/**
 * Configuration tag for the router driver.
 *
 * @since 0.0.1
 */
export class RouterConfig extends Context.Tag("effect-cycle/RouterConfig")<
  RouterConfig,
  RouterConfigShape
>() {}

/**
 * Default router config using hash-based routing with no base path.
 *
 * @since 0.0.1
 */
export const RouterConfigDefault: Layer.Layer<RouterConfig> = Layer.succeed(RouterConfig, {
  mode: "hash",
  base: "",
})

/**
 * Router config using the History API with no base path.
 *
 * @since 0.0.1
 */
export const RouterConfigHistory: Layer.Layer<RouterConfig> = Layer.succeed(RouterConfig, {
  mode: "history",
  base: "",
})
