import { Context, type Effect, type Stream } from "effect"
import type { DOMError } from "./errors.js"

export class DOMSource extends Context.Tag("effect-cycle/DOMSource")<
  DOMSource,
  {
    readonly select: (selector: string) => Stream.Stream<Event>
    readonly element: Effect.Effect<Element, DOMError>
  }
>() {}
