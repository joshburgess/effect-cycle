import type { Effect, Stream } from "effect"
import { Context } from "effect"
import type { RouteLocation } from "./Location.js"

/**
 * Read-only router source service.
 *
 * Provides a stream of route locations and pattern-matching helpers.
 * Emits the initial location immediately, then on every navigation event.
 *
 * @since 0.1.0
 */
export class RouterSource extends Context.Tag("effect-cycle/RouterSource")<
  RouterSource,
  {
    /**
     * Stream of the current route location. Emits the initial location
     * immediately, then emits on every navigation (popstate, pushState,
     * replaceState, hashchange).
     */
    readonly location$: Stream.Stream<RouteLocation>

    /**
     * Read the current location as a one-shot Effect.
     */
    readonly currentLocation: Effect.Effect<RouteLocation>

    /**
     * Stream that emits extracted path params whenever the path matches the
     * given pattern. Non-matching locations are filtered out.
     *
     * Example: `source.matchPath$("/articles/:slug")` emits `{ slug: "my-post" }`
     */
    readonly matchPath$: (pattern: string) => Stream.Stream<Readonly<Record<string, string>>>
  }
>() {}
