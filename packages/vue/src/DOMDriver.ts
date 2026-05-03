import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { render } from "vue"
import { DOMSink } from "./DOMSink.js"

/**
 * Live `DOMSink` implementation for the Vue 3 renderer.
 *
 * Locates the root element via `DOMConfig` and patches subsequent renders
 * with Vue's low-level `render(vnode, container)`. Vue owns the children
 * of the root element and diffs incrementally on each emission. On scope
 * close the contents are unmounted by rendering `null`.
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

    // Vue's `render` expects HostElement (HTMLElement | SVGElement). Narrow
    // querySelector's Element once here so both finalizer and the render
    // loop share the same typed handle.
    const container = rootEl as HTMLElement

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        render(null, container)
      }),
    )

    return DOMSink.of({
      render: (vdom$) =>
        Stream.runForEach(vdom$, (vnode) =>
          Effect.sync(() => {
            render(vnode, container)
          }),
        ).pipe(Effect.forkIn(scope), Effect.asVoid),
    })
  }).pipe(Effect.withSpan("VueSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * Vue 3-backed `DOMSinkLive`.
 *
 * Provides `DOMSource` and `DOMSink`. Requires `DOMConfig`.
 *
 * @since 0.1.0
 */
export const DOMDriverLive = Layer.merge(DOMSourceLive, DOMSinkLive)
