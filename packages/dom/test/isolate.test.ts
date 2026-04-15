// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Option, Queue, Ref, Stream } from "effect"
import { DOMConfig, DOMDriverLive, DOMSource, isolate } from "effect-cycle-dom"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("isolate", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div data-ns="counter">
          <button class="btn">Counter Button</button>
        </div>
        <button class="btn">Root Button</button>
      </div>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it.effect("isolated component's DOMSource only sees events from its namespace", () =>
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<string>()

      // The component runs within isolate's scope. All click-dispatch
      // happens inside the component Effect, before the scope closes.
      const component = Effect.gen(function* () {
        const source = yield* DOMSource
        const stream = source.select(".btn", "click")

        // Collect one event from the stream
        const firstClick = yield* Effect.async<Event>((resolve) => {
          Stream.runForEach(stream, (event) =>
            Effect.sync(() => resolve(Effect.succeed(event))),
          ).pipe(Effect.runFork)

          // Click inside the namespace after listener is attached
          setTimeout(() => {
            const btn = document.querySelector("[data-ns='counter'] .btn") as HTMLButtonElement
            btn.click()
          }, 10)
        })

        const target = firstClick.target as HTMLElement
        const ns = target.closest("[data-ns]")?.getAttribute("data-ns") ?? "root"
        yield* Queue.offer(queue, ns)

        // Now click the root button — isolated component should NOT receive this
        yield* Effect.sync(() => {
          const rootBtn = document.querySelector("#app > .btn") as HTMLButtonElement
          rootBtn.click()
        })

        // Brief async pause to let any spurious events flush
        yield* Effect.async<void>((resolve) => {
          setTimeout(() => resolve(Effect.void), 20)
        })
      })

      yield* isolate(component, "counter").pipe(
        Effect.provide(DOMDriverLive),
        Effect.provide(makeTestConfig("#app")),
      )

      const size = yield* Queue.size(queue)
      expect(size).toBe(1)

      const ns = yield* Queue.take(queue)
      expect(ns).toBe("counter")
    }),
  )

  it.effect("isolated component's element returns the namespaced element", () =>
    Effect.gen(function* () {
      const nsElement = yield* Ref.make<Option.Option<Element>>(Option.none())

      const component = Effect.gen(function* () {
        const source = yield* DOMSource
        const el = yield* source.element
        yield* Ref.set(nsElement, Option.some(el))
      })

      yield* isolate(component, "counter").pipe(
        Effect.provide(DOMDriverLive),
        Effect.provide(makeTestConfig("#app")),
      )

      const result = yield* Ref.get(nsElement)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isSome(result)) {
        expect(result.value.getAttribute("data-ns")).toBe("counter")
      }
    }),
  )
})
