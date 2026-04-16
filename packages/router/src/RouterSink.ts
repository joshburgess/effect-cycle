import type { Effect, Stream } from "effect"
import { Context } from "effect"
import type { Navigation } from "./Navigation.js"

export class RouterSink extends Context.Tag("effect-cycle/RouterSink")<
  RouterSink,
  {
    /**
     * Accept a stream of navigation commands. Each command triggers a
     * pushState, replaceState, or history.go() call. The location$ stream
     * on RouterSource will emit the new location after each navigation.
     *
     * Forks internally -- returns immediately.
     */
    readonly navigate: (nav$: Stream.Stream<Navigation>) => Effect.Effect<void>

    /**
     * Convenience: push a single path. Shorthand for a one-element stream.
     */
    readonly push: (path: string) => Effect.Effect<void>

    /**
     * Convenience: replace the current path.
     */
    readonly replace: (path: string) => Effect.Effect<void>
  }
>() {}
