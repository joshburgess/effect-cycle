// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Stream } from "effect"
import { DOMConfig, DOMError, DOMSource } from "effect-cycle-dom"
import { DOMDriverLive, DOMSink } from "effect-cycle-lit-html"
import { html } from "lit-html"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("DOMDriverLive (lit-html)", () => {
  describe("DOMSource", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="app"><button class="btn">Click</button></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("select emits events when a matching element is clicked", () =>
      Effect.gen(function* () {
        const source = yield* DOMSource
        const stream = source.select(".btn", "click")

        const fiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        yield* Effect.sync(() => {
          const btn = document.querySelector(".btn") as HTMLButtonElement
          btn.click()
        })

        const events = Chunk.toArray(yield* Fiber.join(fiber))
        expect(events).toHaveLength(1)
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("element returns the root element", () =>
      Effect.gen(function* () {
        const source = yield* DOMSource
        const el = yield* source.element
        expect(el.id).toBe("app")
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
    )
  })

  describe("DOMSink", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="app"></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("render mounts the VNode tree into the root element", () =>
      Effect.gen(function* () {
        const sink = yield* DOMSink
        yield* sink.render(Stream.make(html`<p>hello</p>`))

        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const app = yield* Effect.sync(() => document.querySelector("#app"))
        expect(app?.querySelector("p")?.textContent).toBe("hello")
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("subsequent renders patch the existing tree", () =>
      Effect.gen(function* () {
        const sink = yield* DOMSink

        // lit-html keys templates by their raw strings array identity, so we
        // construct both renders from the same template literal site to
        // guarantee in-place patching rather than a full re-mount.
        const view = (text: string) => html`<div id="x">${text}</div>`

        yield* sink.render(Stream.make(view("old")))
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const app = yield* Effect.sync(() => document.querySelector("#app"))
        const originalNode = yield* Effect.sync(() => app?.querySelector("#x"))
        expect(originalNode?.textContent).toBe("old")

        yield* sink.render(Stream.make(view("new")))
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const updatedNode = yield* Effect.sync(() => app?.querySelector("#x"))
        expect(updatedNode?.textContent).toBe("new")
        expect(updatedNode).toBe(originalNode)
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("clears contents after scope closes", () =>
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const sink = yield* DOMSink
            yield* sink.render(Stream.make(html`<p>temporary</p>`))
            yield* Effect.yieldNow()
            yield* Effect.yieldNow()
            const app = yield* Effect.sync(() => document.querySelector("#app"))
            expect(app?.querySelector("p")?.textContent).toBe("temporary")
          }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
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
          yield* DOMSource
        }).pipe(
          Effect.provide(DOMDriverLive),
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
