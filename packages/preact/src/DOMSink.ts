import { Context, type Effect, type Stream } from "effect"
import type { VNode } from "./VNode.js"

/**
 * Write-only DOM sink service for the Preact renderer.
 *
 * Accepts a stream of Preact `VNode` values and renders each emission into
 * the configured root element using `preact.render`.
 *
 * @since 0.1.0
 */
export class DOMSink extends Context.Tag("effect-cycle/PreactSink")<
  DOMSink,
  {
    /**
     * Subscribes to the given VNode stream and renders each emission into the root element.
     *
     * @param vdom$ - A stream of Preact VNodes to render.
     */
    readonly render: (vdom$: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}
