import { Effect, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSourceLive } from "effect-cycle-dom"
import { mount, unmount } from "svelte"
import { type Readable, writable } from "svelte/store"
import { ReactiveSink } from "./ReactiveSink.js"

/**
 * Live `ReactiveSink` implementation for the Svelte 5 renderer.
 *
 * Locates the root element via `DOMConfig`, then exposes:
 *   - `mount(component, props)`: mounts the component once via Svelte's
 *     `mount`, capturing the instance for later unmount.
 *   - `fromStream(stream, initial)`: creates a `writable(initial)` store
 *     and forks a Stream-consuming fiber into the sink scope that pushes
 *     emissions into `set`. Returns the `Readable` view.
 *
 * Calling `mount` more than once unmounts the previous instance before
 * mounting the new component, mirroring the Solid sink's behavior.
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

    // biome-ignore lint/suspicious/noExplicitAny: matches Svelte 5's mount return type.
    let instance: Record<string, any> | null = null

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (instance !== null) {
          // unmount returns a Promise but we don't await; Svelte handles
          // outro asynchronously. Finalizer is sync to match the Solid sink.
          void unmount(instance)
          instance = null
        }
      }),
    )

    return ReactiveSink.of({
      // biome-ignore lint/suspicious/noExplicitAny: see ReactiveSink contract; matches Svelte's own Props constraint.
      mount: <Props extends Record<string, any>>(
        // biome-ignore lint/suspicious/noExplicitAny: see above.
        component: Parameters<typeof mount<Props, any>>[0],
        props: Props,
      ) =>
        Effect.sync(() => {
          if (instance !== null) {
            void unmount(instance)
          }
          instance = mount(component, { target: rootEl, props })
        }),

      fromStream: <A>(s: Stream.Stream<A>, initial: A) =>
        Effect.gen(function* () {
          const store = yield* Effect.sync(() => writable<A>(initial))
          yield* Stream.runForEach(s, (value) => Effect.sync(() => store.set(value))).pipe(
            Effect.forkIn(scope),
          )
          return store as Readable<A>
        }),
    })
  }).pipe(Effect.withSpan("SvelteReactiveSinkLive.acquire")),
)

/**
 * Live driver: combines the renderer-agnostic `DOMSourceLive` with the
 * Svelte-backed `ReactiveSinkLive`.
 *
 * Provides `DOMSource` and `ReactiveSink`. Requires `DOMConfig`.
 *
 * Note: Svelte does not participate in the VDOM-style `DOMSink` contract,
 * so this driver provides `ReactiveSink` instead. Components written
 * against the VDOM `DOMSink` cannot be used unchanged with this driver,
 * by design.
 *
 * @since 0.1.0
 */
export const ReactiveDriverLive = Layer.merge(DOMSourceLive, ReactiveSinkLive)
