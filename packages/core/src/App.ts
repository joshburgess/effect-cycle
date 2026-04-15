import type { Effect } from "effect"

/**
 * An App is an Effect that reads from source services and writes to sink
 * services. The `R` channel accumulates all driver service requirements
 * automatically via `yield*` in `Effect.gen`.
 *
 * The simplest app: `Effect.gen(function* () { ... })` where you
 * `yield*` source/sink tags — TypeScript infers `R` from usage.
 */
export type App<A = void, E = never, R = never> = Effect.Effect<A, E, R>
