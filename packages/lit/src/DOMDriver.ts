import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { nothing, render } from "lit-html"
import { DOMSink } from "./DOMSink.js"

/**
 * Live `DOMSink` implementation for the lit-html renderer.
 *
 * Locates the root element via `DOMConfig` and patches subsequent renders
 * with `lit-html`'s `render`. lit-html maintains its own per-container
 * state and diffs incrementally on each call, so we just hand each
 * emission to `render` and the rest is handled internally. On scope close
 * the contents are cleared by rendering `nothing`.
 *
 * @since 0.1.0
 */
export const DOMSinkLive: Layer.Layer<DOMSink, DOMError, DOMConfig> = Layer.scoped(
  DOMSink,
  Effect.gen(function* () {
    const config = yield* DOMConfig
    const scope = yield* Effect.scope

    const rootEl = yield* Effect.sync(() => document.querySelector(config.rootSelector)).pipe(
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

    // lit-html's `render` accepts HTMLElement | SVGElement | DocumentFragment
    // | ShadowRoot. querySelector returns Element, so narrow once here.
    const container = rootEl as HTMLElement

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        render(nothing, container)
      }),
    )

    return DOMSink.of({
      render: (vdom$) =>
        Stream.runForEach(vdom$, (template) =>
          Effect.sync(() => {
            render(template, container)
          }),
        ).pipe(Effect.forkIn(scope), Effect.asVoid),
    })
  }).pipe(Effect.withSpan("LitSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * lit-html-backed `DOMSinkLive`.
 *
 * Provides `DOMSource` and `DOMSink`. Requires `DOMConfig`.
 *
 * @since 0.1.0
 */
export const DOMDriverLive = Layer.merge(DOMSourceLive, DOMSinkLive)
