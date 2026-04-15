import { Context, type Effect, type Stream } from "effect"
import type { VNode } from "./VNode.js"

export class DOMSink extends Context.Tag("effect-cycle/DOMSink")<
  DOMSink,
  {
    readonly render: (vdom$: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}
