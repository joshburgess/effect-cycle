import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { createSignal } from "solid-js"
import { render } from "solid-js/web"
import { ReactiveSink } from "./ReactiveSink.js"

/**
 * Live `ReactiveSink` implementation for the Solid renderer.
 *
 * Locates the root element via `DOMConfig`, then exposes:
 *   - `render(component)`: mounts the component once via `solid-js/web`'s
 *     `render`, capturing the dispose handle for finalization.
 *   - `fromStream(stream, initial)`: creates a Solid `createSignal`
 *     seeded with `initial` and forks a Stream-consuming fiber into the
 *     sink scope that pushes emissions into the signal's setter.
 *
 * Calling `render` more than once disposes the previous mount before
 * mounting the new component, mirroring the behavior of repeated
 * `solid-js/web.render` calls under a fresh root.
 *
 * @since 0.1.0
 */
export const ReactiveSinkLive: Layer.Layer<ReactiveSink, DOMError, DOMConfig> = Layer.scoped(
  ReactiveSink,
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

    // Solid's `render` expects MountableElement (HTMLElement | DocumentFragment).
    const container = rootEl as HTMLElement

    let dispose: (() => void) | null = null

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (dispose !== null) {
          dispose()
          dispose = null
        }
      }),
    )

    return ReactiveSink.of({
      render: (component) =>
        Effect.sync(() => {
          if (dispose !== null) {
            dispose()
          }
          dispose = render(component, container)
        }),

      fromStream: <A>(s: Stream.Stream<A>, initial: A) =>
        Effect.gen(function* () {
          const [get, set] = yield* Effect.sync(() => createSignal<A>(initial))
          yield* Stream.runForEach(s, (value) => Effect.sync(() => set(() => value))).pipe(
            Effect.forkIn(scope),
          )
          return get
        }),
    })
  }).pipe(Effect.withSpan("SolidReactiveSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * Solid-backed `ReactiveSinkLive`.
 *
 * Provides `DOMSource` and `ReactiveSink`. Requires `DOMConfig`.
 *
 * Note: Solid does not participate in the VDOM-style `DOMSink` contract,
 * so this driver provides `ReactiveSink` instead. Components written
 * against the VDOM `DOMSink` cannot be used unchanged with this driver,
 * by design.
 *
 * @since 0.1.0
 */
export const ReactiveDriverLive = Layer.merge(DOMSourceLive, ReactiveSinkLive)
