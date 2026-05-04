import { DefaultScheduler } from "aeon-scheduler"
import { Context, Effect, Layer, Stream } from "effect"
import { DOMScheduler, DOMSource } from "effect-cycle-dom"

/**
 * Creates a test `DOMSource` layer that replays scripted events.
 *
 * Also provides `DOMScheduler` so components using `isolate` (which depends
 * on it) can be exercised under the test layer without wiring a separate
 * scheduler.
 *
 * @param events - A record mapping CSS selectors to arrays of events to emit.
 * @returns A `Layer` providing `DOMSource` and `DOMScheduler` with the scripted events.
 *
 * @since 0.1.0
 */
export const TestDOMSource = (
  events: Record<string, ReadonlyArray<Event>>,
): Layer.Layer<DOMSource | DOMScheduler> =>
  Layer.succeedContext(
    Context.empty().pipe(
      Context.add(DOMSource, {
        select: (sel: string, _eventType: string) => Stream.fromIterable(events[sel] ?? []),
        element: Effect.succeed(document.createElement("div")),
      }),
      Context.add(DOMScheduler, new DefaultScheduler()),
    ),
  )
