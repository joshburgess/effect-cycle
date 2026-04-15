import { Context, Layer } from "effect"

export class DevToolsConfig extends Context.Tag("effect-cycle/DevToolsConfig")<
  DevToolsConfig,
  {
    readonly logLevel: "debug" | "info" | "none"
    readonly enableMetrics: boolean
    readonly enableSpans: boolean
  }
>() {}

export const DevToolsConfigDefault = Layer.succeed(DevToolsConfig, {
  logLevel: "info",
  enableMetrics: true,
  enableSpans: true,
})
