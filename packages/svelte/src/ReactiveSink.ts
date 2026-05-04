import { Context, type Effect, type Stream } from "effect"
import type { Component } from "svelte"
import type { Readable } from "svelte/store"

/**
 * Reactive DOM sink for the Svelte 5 renderer.
 *
 * Like {@link "effect-cycle-solid".ReactiveSink | the Solid sink}, the
 * Svelte sink does NOT take a stream of VDOM nodes. Svelte 5 mounts a
 * component once and updates the DOM through reactive primitives (runes
 * and stores), so a stream of full trees would defeat its compile-time
 * tracked update path.
 *
 * Instead the contract is:
 *   - {@link mount}: mount a Svelte component once with the given props.
 *   - {@link fromStream}: bridge an Effect `Stream<A>` into a Svelte
 *     `Readable<A>` store. The component subscribes to the store via the
 *     `$store` shorthand and the DOM updates fine-grained.
 *
 * @since 0.1.0
 */
export class ReactiveSink extends Context.Tag("effect-cycle/SvelteReactiveSink")<
  ReactiveSink,
  {
    /**
     * Mounts a Svelte 5 component into the configured root element with
     * the given props.
     *
     * Calling `mount` again disposes the previous mount before mounting
     * the new component. On scope close, the latest mount is unmounted.
     *
     * The `Props` type parameter is constrained to `Record<string, any>`
     * because that is Svelte 5's own constraint on component props. The
     * `any` is unavoidable at this boundary; downstream code should rely
     * on the Svelte component's own typed props for safety.
     */
    // biome-ignore lint/suspicious/noExplicitAny: Svelte's own Component<Props> uses `any` for the bindings parameter; this matches the upstream constraint.
    readonly mount: <Props extends Record<string, any>>(
      // biome-ignore lint/suspicious/noExplicitAny: see above; Component<Props, Exports, Bindings> requires `any` here.
      component: Component<Props, any, any>,
      props: Props,
    ) => Effect.Effect<void>

    /**
     * Bridges an Effect `Stream<A>` into a Svelte `Readable<A>` store.
     *
     * Creates a `writable(initial)` internally, then forks a fiber that
     * subscribes to `s` and pushes each emission into the store. The
     * fiber is scoped to the sink, so subscriptions are released when
     * the sink scope closes.
     *
     * Returns the `Readable` interface so callers cannot bypass the
     * stream by writing directly. Pass it as a prop to a component and
     * read it inside the template with `$store`.
     *
     * @param s - The source stream.
     * @param initial - The initial value, used until the stream emits.
     */
    readonly fromStream: <A>(s: Stream.Stream<A>, initial: A) => Effect.Effect<Readable<A>>
  }
>() {}
