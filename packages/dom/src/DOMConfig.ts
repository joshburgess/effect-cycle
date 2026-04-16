import { Context, Effect, Layer } from "effect"

/**
 * Configuration for the DOM driver.
 *
 * @since 0.1.0
 */
export class DOMConfig extends Context.Tag("effect-cycle/DOMConfig")<
  DOMConfig,
  {
    /** CSS selector for the root element where the app renders. */
    readonly rootSelector: string
  }
>() {}

/**
 * Default DOM configuration that renders into `#app`.
 *
 * @since 0.1.0
 */
export const DOMConfigDefault = Layer.succeed(DOMConfig, { rootSelector: "#app" })
