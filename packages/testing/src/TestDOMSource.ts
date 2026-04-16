import { Effect, Layer, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"

/**
 * Creates a test `DOMSource` layer that replays scripted events.
 *
 * @param events - A record mapping CSS selectors to arrays of events to emit.
 * @returns A `Layer` providing `DOMSource` with the scripted events.
 *
 * @since 0.1.0
 */
export const TestDOMSource = (
  events: Record<string, ReadonlyArray<Event>>,
): Layer.Layer<DOMSource> =>
  Layer.succeed(DOMSource, {
    select: (sel: string, _eventType: string) => Stream.fromIterable(events[sel] ?? []),
    element: Effect.succeed(document.createElement("div")),
  })
