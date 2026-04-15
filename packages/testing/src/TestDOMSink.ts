import { Effect, Layer, Stream } from "effect"
import { DOMSink } from "effect-cycle-dom"
import type { VNode } from "effect-cycle-dom"

export const TestDOMSink = () => {
  const rendered: Array<VNode> = []
  const layer = Layer.succeed(DOMSink, {
    render: (vdom$: Stream.Stream<VNode>) =>
      Stream.runForEach(vdom$, (v) =>
        Effect.sync(() => {
          rendered.push(v)
        }),
      ),
  })
  return { layer, rendered } as const
}
