import { Context, Layer } from "effect"

/**
 * Configuration for the DevTools instrumentation layer.
 *
 * @since 0.1.0
 */
export class DevToolsConfig extends Context.Tag("effect-cycle/DevToolsConfig")<
  DevToolsConfig,
  {
    /** Logging verbosity. `"none"` disables all instrumentation logs. */
    readonly logLevel: "debug" | "info" | "none"
    /** Whether to emit counter metrics for requests, renders, etc. */
    readonly enableMetrics: boolean
    /** Whether to wrap driver methods with Effect spans. */
    readonly enableSpans: boolean
  }
>() {}

/**
 * Default DevTools configuration: info logging, metrics and spans enabled.
 *
 * @since 0.1.0
 */
export const DevToolsConfigDefault = Layer.succeed(DevToolsConfig, {
  logLevel: "info",
  enableMetrics: true,
  enableSpans: true,
})
