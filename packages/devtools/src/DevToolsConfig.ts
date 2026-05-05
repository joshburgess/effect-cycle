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
    /**
     * Whether to publish structured events to `DevToolsBus`. Off by
     * default: PubSub-based event publication has a (small) cost that
     * production builds should not pay unless an inspector UI or panel
     * is actively subscribing.
     */
    readonly enableEvents: boolean
  }
>() {}

/**
 * Default DevTools configuration: info logging, metrics and spans enabled.
 * Event publication is off by default; flip `enableEvents` to `true`
 * (and provide `DevToolsBusLive`) to subscribe an inspector panel.
 *
 * @since 0.1.0
 */
export const DevToolsConfigDefault = Layer.succeed(DevToolsConfig, {
  logLevel: "info",
  enableMetrics: true,
  enableSpans: true,
  enableEvents: false,
})
