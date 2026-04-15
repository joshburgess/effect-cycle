import { Context, Effect, Layer, Stream } from "effect"
import morphdom from "morphdom"
import { DOMConfig } from "./DOMConfig.js"
import { DOMSink } from "./DOMSink.js"
import { DOMSource } from "./DOMSource.js"
import { DOMError } from "./errors.js"

export const DOMDriverLive: Layer.Layer<DOMSource | DOMSink, DOMError, DOMConfig> =
  Layer.scopedContext(
    Effect.gen(function* () {
      const config = yield* DOMConfig

      const root = yield* Effect.sync(() => document.querySelector(config.rootSelector)).pipe(
        Effect.flatMap((el) =>
          el !== null
            ? Effect.succeed(el)
            : Effect.fail(
                new DOMError({
                  selector: config.rootSelector,
                  message: `Root element not found: ${config.rootSelector}`,
                }),
              ),
        ),
      )

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          root.innerHTML = ""
        }),
      )

      const source: DOMSource["Type"] = {
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

      const sink: DOMSink["Type"] = {
        render: (vdom$) =>
          Effect.gen(function* () {
            yield* Stream.runForEach(vdom$, (html) =>
              Effect.sync(() => {
                const template = document.createElement("template")
                template.innerHTML = html.trim()
                const newContent = template.content.firstElementChild

                if (newContent) {
                  if (root.firstElementChild) {
                    morphdom(root.firstElementChild, newContent)
                  } else {
                    root.innerHTML = html
                  }
                } else {
                  root.innerHTML = html
                }
              }),
            ).pipe(Effect.fork)
          }),
      }

      return Context.empty().pipe(Context.add(DOMSource, source), Context.add(DOMSink, sink))
    }),
  )
