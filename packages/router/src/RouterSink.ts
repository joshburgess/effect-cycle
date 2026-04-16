import type { Effect, Stream } from "effect"
import { Context } from "effect"
import type { Navigation } from "./Navigation.js"
import type { RouterError } from "./errors.js"

/**
 * Write-only router sink service.
 *
 * Accepts navigation commands to push, replace, or go back/forward
 * in the browser history. Navigation methods may fail with `RouterError`
 * if the browser rejects the operation (e.g. SecurityError).
 *
 * @since 0.0.1
 */
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
    readonly navigate: (nav$: Stream.Stream<Navigation>) => Effect.Effect<void, RouterError>

    /**
     * Convenience: push a single path. Shorthand for a one-element stream.
     */
    readonly push: (path: string) => Effect.Effect<void, RouterError>

    /**
     * Convenience: replace the current path.
     */
    readonly replace: (path: string) => Effect.Effect<void, RouterError>
  }
>() {}
