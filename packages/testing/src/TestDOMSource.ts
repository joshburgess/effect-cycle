import { Effect, Layer, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"

export const TestDOMSource = (
  events: Record<string, ReadonlyArray<Event>>,
): Layer.Layer<DOMSource> =>
  Layer.succeed(DOMSource, {
    select: (sel: string) => Stream.fromIterable(events[sel] ?? []),
    element: Effect.succeed(document.createElement("div")),
  })
