import { Context, type Effect, type Stream } from "effect"
import type { Accessor, JSX } from "solid-js"

/**
 * Reactive DOM sink for the Solid renderer.
 *
 * Unlike the VDOM-style {@link DOMSink} contract used by morphdom/tachys/
 * preact/react/lit-html/vue, the Solid sink does NOT take a stream of
 * VNodes. Solid mounts a component once and then drives DOM updates from
 * signals, so a stream of full trees would defeat its fine-grained
 * reactivity.
 *
 * Instead the contract is:
 *   - {@link render}: mount a component function once.
 *   - {@link fromStream}: bridge an Effect `Stream<A>` into a Solid
 *     `Accessor<A>` so the component can read it reactively.
 *
 * @since 0.1.0
 */
export class ReactiveSink extends Context.Tag("effect-cycle/SolidReactiveSink")<
  ReactiveSink,
  {
    /**
     * Mounts the given component into the configured root element.
     *
     * The component is a zero-argument function returning a JSX element
     * (or `solid-js/h` hyperscript node). Solid runs it exactly once at
     * mount and tracks signal reads to wire up fine-grained DOM updates.
     *
     * On scope close, Solid's dispose function is called to unmount and
     * clean up reactive subscriptions.
     */
    readonly render: (component: () => JSX.Element) => Effect.Effect<void>

    /**
     * Bridges an Effect `Stream<A>` into a Solid `Accessor<A>`.
     *
     * Creates a Solid signal seeded with `initial`, then forks a fiber
     * that subscribes to `s` and pushes each emission into the signal.
     * The fiber is scoped to the sink, so subscriptions are released
     * when the sink scope closes.
     *
     * The returned accessor can be called inside a component or `solid-js`
     * reactive primitive (`createEffect`, `createMemo`, etc.) to track
     * the latest stream value.
     *
     * @param s - The source stream.
     * @param initial - The initial value, used until the stream emits.
     */
    readonly fromStream: <A>(s: Stream.Stream<A>, initial: A) => Effect.Effect<Accessor<A>>
  }
>() {}
