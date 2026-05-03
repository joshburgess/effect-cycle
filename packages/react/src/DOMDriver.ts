import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { DOMSink } from "./DOMSink.js"

/**
 * Live `DOMSink` implementation for the React renderer.
 *
 * Locates the root element via `DOMConfig`, creates a React root with
 * `createRoot` (the React 18+ client API), and renders subsequent emissions
 * with `Root.render`, wrapped in `flushSync` so DOM updates are visible
 * synchronously (matching the behavior of the tachys and morphdom sinks).
 * The root is unmounted when the layer's scope closes.
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
            flushSync(() => {
              root.render(vnode)
            })
          }),
        ).pipe(Effect.forkIn(scope), Effect.asVoid),
    })
  }).pipe(Effect.withSpan("ReactSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * React-backed `DOMSinkLive`.
 *
 * Provides `DOMSource` and `DOMSink`. Requires `DOMConfig`.
 *
 * @since 0.1.0
 */
export const DOMDriverLive = Layer.merge(DOMSourceLive, DOMSinkLive)
