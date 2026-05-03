import { merge } from "aeon-core"
import { fromDOMEvent } from "aeon-dom"
import { toStream } from "aeon-effect"
import { DefaultScheduler } from "aeon-scheduler"
import { Effect, Layer, Stream } from "effect"
import { DOMConfig } from "./DOMConfig.js"
import { DOMSource } from "./DOMSource.js"
import { DOMError } from "./errors.js"

/**
 * Live, renderer-agnostic implementation of `DOMSource`.
 *
 * Captures DOM events scoped to the root element configured via `DOMConfig`,
 * exposing them as `Stream<Event>`. Renderers compose this with their own
 * `DOMSink` to form a full driver.
 *
 * @since 0.1.0
 */
export const DOMSourceLive: Layer.Layer<DOMSource, DOMError, DOMConfig> = Layer.scoped(
  DOMSource,
  Effect.gen(function* () {
    const config = yield* DOMConfig

    const root = yield* Effect.sync(() => document.querySelector(config.rootSelector)).pipe(
      Effect.flatMap((el) =>
        el !== null
          ? Effect.succeed(el)
          : Effect.fail(
              new DOMError({
                selector: config.rootSelector,
                message: `Root element not found: ${config.rootSelector}`,
              }),
            ),
      ),
    )

    const scheduler = yield* Effect.sync(() => new DefaultScheduler())

    return DOMSource.of({
      select: (selector: string, eventType: string) => {
        const elements = Array.from(root.querySelectorAll(selector))
        if (elements.length === 0) return Stream.empty

        const events = elements.map((el) => fromDOMEvent(eventType, el))
        const combined = events.length === 1 ? events[0]! : merge(...events)
        return toStream(combined, scheduler)
      },

      element: Effect.succeed(root),
    })
  }).pipe(Effect.withSpan("DOMSourceLive.acquire")),
)
