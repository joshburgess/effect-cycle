import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { createRoot } from "tachys/sync"
import { DOMSink } from "./DOMSink.js"

/**
 * Live `DOMSink` implementation for the tachys renderer.
 *
 * Locates the root element via `DOMConfig`, creates a tachys root using
 * the sync (`tachys/sync`) entry point, and renders subsequent emissions
 * with `Root.render`.
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

    const root = yield* Effect.sync(() => createRoot(rootEl))

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        root.unmount()
      }),
    )

    return DOMSink.of({
      render: (vdom$) =>
        Stream.runForEach(vdom$, (vnode) =>
          Effect.sync(() => {
            root.render(vnode)
          }),
        ).pipe(Effect.forkIn(scope), Effect.asVoid),
    })
  }).pipe(Effect.withSpan("TachysSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * tachys-backed `DOMSinkLive`.
 *
 * Provides `DOMSource` and `DOMSink`. Requires `DOMConfig`.
 *
 * @since 0.1.0
 */
export const DOMDriverLive = Layer.merge(DOMSourceLive, DOMSinkLive)
