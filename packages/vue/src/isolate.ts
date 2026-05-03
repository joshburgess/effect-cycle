import { merge } from "aeon-core"
import { fromDOMEvent } from "aeon-dom"
import { toStream } from "aeon-effect"
import { DefaultScheduler } from "aeon-scheduler"
import { Context, Effect, Stream } from "effect"
import { DOMError, DOMSource } from "effect-cycle-dom"
import { DOMSink } from "./DOMSink.js"

/**
 * Isolates a component into a namespaced DOM subtree.
 *
 * - The component's `DOMSource` scopes selectors within `[data-ns="${namespace}"]`.
 * - The component's `DOMSink` renders into the parent's sink (rendering is
 *   coordinated at the top level by the Vue root).
 *
 * Fails with {@link DOMError} if the namespace element does not exist
 * inside the parent's root.
 *
 * @example
 * ```ts
 * const counter = Effect.gen(function* () {
 *   const dom = yield* DOMSource
 *   const sink = yield* DOMSink
 *   // ... component logic, scoped to the namespaced root
 * })
 *
 * const app = isolate(counter, "my-counter")
 * ```
 *
 * @since 0.1.0
 */
export const isolate = <A, E, R>(
  component: Effect.Effect<A, E, R>,
  namespace: string,
): Effect.Effect<A, E | DOMError, Exclude<R, DOMSource | DOMSink> | DOMSource | DOMSink> =>
  Effect.scoped(
    Effect.gen(function* () {
      const parentSource = yield* DOMSource
      const parentSink = yield* DOMSink

      const nsSelector = `[data-ns="${namespace}"]`

      const root = yield* Effect.flatMap(parentSource.element, (parentRoot) =>
        Effect.sync(() => parentRoot.querySelector(nsSelector)).pipe(
          Effect.flatMap((el) =>
            el !== null
              ? Effect.succeed(el)
              : Effect.fail(
                  new DOMError({
                    selector: nsSelector,
                    message: `Namespace element not found: ${nsSelector}`,
                  }),
                ),
          ),
        ),
      )

      const scheduler = yield* Effect.sync(() => new DefaultScheduler())

      const namespacedSource: DOMSource["Type"] = {
        select: (selector: string, eventType: string) => {
          const elements = Array.from(root.querySelectorAll(selector))
          if (elements.length === 0) return Stream.empty

          const events = elements.map((el) => fromDOMEvent(eventType, el))
          const combined = events.length === 1 ? events[0]! : merge(...events)
          return toStream(combined, scheduler)
        },

        element: Effect.succeed(root),
      }

      const namespacedSink: DOMSink["Type"] = {
        render: (vdom$) => parentSink.render(vdom$),
      }

      const ctx = Context.empty().pipe(
        Context.add(DOMSource, namespacedSource),
        Context.add(DOMSink, namespacedSink),
      )

      return yield* Effect.provide(component, ctx)
    }),
  )
