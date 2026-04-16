import { Context, Layer } from "effect"

export interface RouterConfigShape {
  /** "hash" uses window.location.hash; "history" uses the History API. */
  readonly mode: "hash" | "history"
  /** Base path prefix stripped from all routes. Default: "" */
  readonly base: string
}

export class RouterConfig extends Context.Tag("effect-cycle/RouterConfig")<
  RouterConfig,
  RouterConfigShape
>() {}

export const RouterConfigDefault: Layer.Layer<RouterConfig> = Layer.succeed(RouterConfig, {
  mode: "hash",
  base: "",
})

export const RouterConfigHistory: Layer.Layer<RouterConfig> = Layer.succeed(RouterConfig, {
  mode: "history",
  base: "",
})
