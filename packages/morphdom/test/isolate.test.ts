// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Option, Queue, Ref, Stream } from "effect"
import { DOMConfig, DOMSource } from "effect-cycle-dom"
import { DOMDriverLive, isolate } from "effect-cycle-morphdom"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("isolate (morphdom)", () => {
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

      const component = Effect.gen(function* () {
        const source = yield* DOMSource
        const stream = source.select(".btn", "click")

        const fiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        yield* Effect.sync(() => {
          const btn = document.querySelector("[data-ns='counter'] .btn") as HTMLButtonElement
          btn.click()
        })

        const events = Chunk.toArray(yield* Fiber.join(fiber))
        const firstClick = events[0] as Event
        const target = firstClick.target as HTMLElement
        const ns = target.closest("[data-ns]")?.getAttribute("data-ns") ?? "root"
        yield* Queue.offer(queue, ns)

        yield* Effect.sync(() => {
          const rootBtn = document.querySelector("#app > .btn") as HTMLButtonElement
          rootBtn.click()
        })

        yield* Effect.yieldNow()
        yield* Effect.yieldNow()
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
