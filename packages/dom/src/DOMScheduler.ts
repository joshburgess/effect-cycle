import type { Scheduler } from "aeon-types"
import { Context } from "effect"

/**
 * Scheduler shared by `DOMSourceLive` and `isolate` helpers when converting
 * aeon `Event` streams of DOM events into Effect `Stream`s.
 *
 * Provided by `DOMSourceLive` so a single `DefaultScheduler` instance is
 * reused across the driver, including any number of `isolate` calls. This
 * avoids allocating a fresh per-component microtask queue and keeps event
 * dispatch ordering consistent across isolated subtrees.
 *
 * @since 0.1.0
 */
export class DOMScheduler extends Context.Tag("effect-cycle/DOMScheduler")<
  DOMScheduler,
  Scheduler
>() {}
