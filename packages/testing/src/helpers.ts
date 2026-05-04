import { Effect, type Layer } from "effect"
import type { App } from "effect-cycle-core"

/**
 * Convenience runner for end-to-end "spin up the whole app" smoke tests.
 *
 * Prefer `it.effect` from `@effect/vitest` for normal unit tests: it manages
 * the runtime, scopes, and `TestClock` for you. Reach for `runTest` only when
 * you need to drive an entire `App` (returned by `mountApp`) as a Promise from
 * inside a plain `it` block, e.g. when asserting on side effects captured by
 * a real DOM under jsdom and you need the runtime to outlive a synchronous
 * setup phase.
 *
 * The app is provided with `layers`, wrapped in `Effect.scoped`, and executed
 * with `Effect.runPromise`. The `Effect.scoped` wrapper guarantees that
 * driver finalizers (DOM cleanup, WebSocket close, etc.) run when the app
 * completes, even though smoke tests typically don't depend on this.
 *
 * @param app - The effect-cycle app to run.
 * @param layers - Test driver layers satisfying the app's requirements.
 * @returns A Promise that resolves when the app completes.
 *
 * @since 0.1.0
 */
export const runTest = <E, R>(app: App<void, E, R>, layers: Layer.Layer<R>): Promise<void> =>
  Effect.runPromise(Effect.scoped(app.pipe(Effect.provide(layers))))
