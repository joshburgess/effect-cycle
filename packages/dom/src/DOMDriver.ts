import { merge } from "aeon-core"
import { fromDOMEvent } from "aeon-dom"
import { toStream } from "aeon-effect"
import { DefaultScheduler } from "aeon-scheduler"
import { Context, Effect, Layer, Stream } from "effect"
import morphdom from "morphdom"
import { DOMConfig } from "./DOMConfig.js"
import { DOMSink } from "./DOMSink.js"
import { DOMSource } from "./DOMSource.js"
import { DOMError } from "./errors.js"

/**
 * Live implementation of the DOM driver.
 *
 * Provides `DOMSource` and `DOMSink` backed by the browser DOM.
 * Uses morphdom for efficient DOM patching and aeon streams for event capture.
 *
 * Requires `DOMConfig` to locate the root element.
 *
 * @since 0.0.1
 */
export const DOMDriverLive: Layer.Layer<DOMSource | DOMSink, DOMError, DOMConfig> =
  Layer.scopedContext(
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

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          root.innerHTML = ""
        }),
      )

      const scheduler = yield* Effect.sync(() => new DefaultScheduler())

      const source: DOMSource["Type"] = {
        select: (selector: string, eventType: string) => {
          const elements = Array.from(root.querySelectorAll(selector))
          if (elements.length === 0) return Stream.empty

          const events = elements.map((el) => fromDOMEvent(eventType, el))
          const combined = events.length === 1 ? events[0]! : merge(...events)
          return toStream(combined, scheduler)
        },

        element: Effect.succeed(root),
      }

      const sink: DOMSink["Type"] = {
        render: (vdom$) =>
          Effect.gen(function* () {
            yield* Stream.runForEach(vdom$, (html) =>
              Effect.sync(() => {
                const template = document.createElement("template")
                template.innerHTML = html.trim()
                const newContent = template.content.firstElementChild

                if (newContent) {
                  if (root.firstElementChild) {
                    morphdom(root.firstElementChild, newContent)
                  } else {
                    root.innerHTML = html
                  }
                } else {
                  root.innerHTML = html
                }
              }),
            ).pipe(Effect.fork)
          }),
      }

      return Context.empty().pipe(Context.add(DOMSource, source), Context.add(DOMSink, sink))
    }),
  )
