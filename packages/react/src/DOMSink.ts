import { Context, type Effect, type Stream } from "effect"
import type { VNode } from "./VNode.js"

/**
 * Write-only DOM sink service for the React renderer.
 *
 * Accepts a stream of React `ReactElement` values and renders each emission
 * into the configured root element via `react-dom/client`'s `createRoot`.
 *
 * @since 0.1.0
 */
export class DOMSink extends Context.Tag("effect-cycle/ReactSink")<
  DOMSink,
  {
    /**
     * Subscribes to the given VNode stream and renders each emission into the root element.
     *
     * @param vdom$ - A stream of React elements to render.
     */
    readonly render: (vdom$: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}
