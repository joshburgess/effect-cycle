import { Context, type Effect, type Stream } from "effect"
import type { VNode } from "./VNode.js"

/**
 * Write-only DOM sink service for the lit-html renderer.
 *
 * Accepts a stream of lit-html `TemplateResult` values and renders each
 * emission into the configured root element using `lit-html`'s `render`.
 *
 * @since 0.1.0
 */
export class DOMSink extends Context.Tag("effect-cycle/LitHtmlSink")<
  DOMSink,
  {
    /**
     * Subscribes to the given VNode stream and renders each emission into the root element.
     *
     * @param vdom$ - A stream of lit-html template results to render.
     */
    readonly render: (vdom$: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}
