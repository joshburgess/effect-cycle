import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import morphdom from "morphdom"
import { DOMSink } from "./DOMSink.js"

/**
 * Live `DOMSink` implementation for the morphdom renderer.
 *
 * Locates the root element via `DOMConfig` and patches subsequent
 * renders with morphdom for efficient updates.
 *
 * @since 0.1.0
 */
export const DOMSinkLive: Layer.Layer<DOMSink, DOMError, DOMConfig> = Layer.scoped(
  DOMSink,
  Effect.gen(function* () {
    const config = yield* DOMConfig
    const scope = yield* Effect.scope

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

    return DOMSink.of({
      render: (vdom$) =>
        Stream.runForEach(vdom$, (html) =>
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
        ).pipe(Effect.forkIn(scope), Effect.asVoid),
    })
  }).pipe(Effect.withSpan("MorphdomSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * morphdom-backed `DOMSinkLive`.
 *
 * Provides `DOMSource` and `DOMSink`. Requires `DOMConfig`.
 *
 * @since 0.1.0
 */
export const DOMDriverLive = Layer.merge(DOMSourceLive, DOMSinkLive)
