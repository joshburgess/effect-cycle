// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Queue, Stream } from "effect"
import { DOMConfig, DOMError, DOMSource } from "effect-cycle-dom"
import { ReactiveDriverLive, ReactiveSink } from "effect-cycle-solid"
import h from "solid-js/h"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("ReactiveDriverLive (solid)", () => {
  describe("DOMSource", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="app"></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("element returns the root element", () =>
      Effect.gen(function* () {
        const source = yield* DOMSource
        const el = yield* source.element
        expect(el.id).toBe("app")
      }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
    )
  })

  describe("ReactiveSink", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="app"></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("render mounts a static component once", () =>
      Effect.gen(function* () {
        const sink = yield* ReactiveSink
        yield* sink.render(h("p", null, "hello"))

        const app = yield* Effect.sync(() => document.querySelector("#app"))
        expect(app?.querySelector("p")?.textContent).toBe("hello")
      }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect(
      "fromStream bridges Stream emissions into a Solid signal that updates the DOM in place",
      () =>
        Effect.gen(function* () {
          const sink = yield* ReactiveSink

          // A queue-driven stream so the test can deterministically push values.
          const queue = yield* Queue.unbounded<number>()
          const count = yield* sink.fromStream(Stream.fromQueue(queue), 0)

          yield* sink.render(h("h1", { id: "out" }, () => `Count: ${count()}`))

          // initial value
          const out = yield* Effect.sync(() => document.querySelector("#out") as HTMLElement)
          const originalNode = out
          expect(out.textContent).toBe("Count: 0")

          // push a value, give the forked fiber a tick to drain
          yield* Queue.offer(queue, 1)
          yield* Effect.yieldNow()
          yield* Effect.yieldNow()
          expect(out.textContent).toBe("Count: 1")

          // push again, assert in-place update (same DOM node, fine-grained text update)
          yield* Queue.offer(queue, 42)
          yield* Effect.yieldNow()
          yield* Effect.yieldNow()
          expect(out.textContent).toBe("Count: 42")
          const stillSame = yield* Effect.sync(() => document.querySelector("#out"))
          expect(stillSame).toBe(originalNode)
        }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("render disposes the previous mount when called again", () =>
      Effect.gen(function* () {
        const sink = yield* ReactiveSink
        yield* sink.render(h("p", { class: "first" }, "first"))

        const first = yield* Effect.sync(() => document.querySelector("#app .first"))
        expect(first?.textContent).toBe("first")

        yield* sink.render(h("p", { class: "second" }, "second"))

        const firstAfter = yield* Effect.sync(() => document.querySelector("#app .first"))
        const secondAfter = yield* Effect.sync(() => document.querySelector("#app .second"))
        expect(firstAfter).toBeNull()
        expect(secondAfter?.textContent).toBe("second")
      }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("disposes mount and clears DOM after scope closes", () =>
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const sink = yield* ReactiveSink
            yield* sink.render(h("p", null, "temporary"))
            const app = yield* Effect.sync(() => document.querySelector("#app"))
            expect(app?.querySelector("p")?.textContent).toBe("temporary")
          }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
        )

        const app = yield* Effect.sync(() => document.querySelector("#app"))
        expect(app?.querySelector("p")).toBeNull()
      }),
    )
  })

  describe("error handling", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="other"></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("fails with DOMError when root element is not found", () =>
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          yield* ReactiveSink
        }).pipe(
          Effect.provide(ReactiveDriverLive),
          Effect.provide(makeTestConfig("#nonexistent")),
          Effect.either,
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left).toBeInstanceOf(DOMError)
          expect((result.left as DOMError).selector).toBe("#nonexistent")
        }
      }),
    )
  })
})
