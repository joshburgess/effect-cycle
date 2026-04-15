import { Context, Effect, Stream } from "effect"
import { DOMSink } from "./DOMSink.js"
import { DOMSource } from "./DOMSource.js"
import { DOMError } from "./errors.js"

/**
 * Isolates a component into a namespaced DOM subtree.
 *
 * - The component's DOMSource scopes selectors within `[data-ns="${namespace}"]`
 * - The component's DOMSink renders into the `[data-ns="${namespace}"]` child element
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

      const namespacedSource: DOMSource["Type"] = {
        select: (selector: string) =>
          Stream.async<Event>((emit) => {
            const handler = (event: Event) => {
              void emit.single(event)
            }

            const elements = root.querySelectorAll(selector)
            elements.forEach((el) => el.addEventListener("click", handler))

            return Effect.sync(() => {
              elements.forEach((el) => el.removeEventListener("click", handler))
            })
          }),

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
