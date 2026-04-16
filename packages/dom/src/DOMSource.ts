import { Context, type Effect, type Stream } from "effect"
import type { DOMError } from "./errors.js"

/**
 * Read-only DOM source service.
 *
 * Provides streams of DOM events scoped to the driver's root element.
 * Yield this tag inside `Effect.gen` to access the DOM.
 *
 * @since 0.0.1
 */
export class DOMSource extends Context.Tag("effect-cycle/DOMSource")<
  DOMSource,
  {
    /**
     * Returns a `Stream` of DOM events matching the given CSS selector and event type.
     *
     * @param selector - CSS selector to scope events to (e.g. ".btn", "#form").
     * @param eventType - DOM event name (e.g. "click", "input", "submit").
     */
    readonly select: (selector: string, eventType: string) => Stream.Stream<Event>
    /** Returns the root DOM element managed by this driver. */
    readonly element: Effect.Effect<Element, DOMError>
  }
>() {}
