import type { Effect } from "effect"

/**
 * An effect-cycle application.
 *
 * An `App` is simply an `Effect` that reads from source services (e.g.
 * `DOMSource`, `HTTPSource`) and writes to sink services (e.g. `DOMSink`,
 * `HTTPSink`). The `R` channel accumulates all driver service requirements
 * automatically via `yield*` in `Effect.gen`.
 *
 * @typeParam A - The success value type (typically `void` for long-running apps).
 * @typeParam E - The error channel type.
 * @typeParam R - The required service dependencies (inferred from `yield*`).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { DOMSource, DOMSink } from "effect-cycle-dom"
 *
 * const app: App<void, never, DOMSource | DOMSink> = Effect.gen(function* () {
 *   const dom = yield* DOMSource
 *   const sink = yield* DOMSink
 *   // ...
 * })
 * ```
 *
 * @since 0.1.0
 */
export type App<A = void, E = never, R = never> = Effect.Effect<A, E, R>
