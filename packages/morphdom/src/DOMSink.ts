import { Context, type Effect, type Stream } from "effect"
import type { VNode } from "./VNode.js"

/**
 * Write-only DOM sink service for the morphdom renderer.
 *
 * Accepts a stream of HTML-string `VNode` values and patches them into
 * the DOM using morphdom for efficient updates.
 *
 * @since 0.1.0
 */
export class DOMSink extends Context.Tag("effect-cycle/MorphdomSink")<
  DOMSink,
  {
    /**
     * Subscribes to the given VNode stream and renders each emission into the root element.
     *
     * @param vdom$ - A stream of HTML strings to render.
     */
    readonly render: (vdom$: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}
