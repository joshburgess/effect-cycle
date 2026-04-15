// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Stream, TestClock } from "effect"
import { DOMConfig, DOMDriverLive, DOMError, DOMSink, DOMSource } from "effect-cycle-dom"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("DOMDriverLive", () => {
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

        const clickReceived = yield* Effect.async<boolean>((resolve) => {
          let done = false
          const stream = source.select(".btn")

          Stream.runForEach(stream, () =>
            Effect.sync(() => {
              if (!done) {
                done = true
                resolve(Effect.succeed(true))
              }
            }),
          ).pipe(Effect.runFork)

          // Trigger click after listener is set up
          setTimeout(() => {
            const btn = document.querySelector(".btn") as HTMLButtonElement
            btn.click()
          }, 10)
        })

        expect(clickReceived).toBe(true)
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

    it.effect("render sets innerHTML on the root element", () =>
      Effect.gen(function* () {
        const sink = yield* DOMSink
        yield* sink.render(Stream.make("<p>hello</p>"))

        // Yield to the scheduler to let the forked fiber run the synchronous stream
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const app = document.querySelector("#app")
        expect(app?.innerHTML).toBe("<p>hello</p>")
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("finalizer clears innerHTML after scope closes", () =>
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const sink = yield* DOMSink
            yield* sink.render(Stream.make("<p>temporary</p>"))
            // Yield to let the forked fiber process the synchronous stream
            yield* Effect.yieldNow()
            yield* Effect.yieldNow()
            const app = document.querySelector("#app")
            expect(app?.innerHTML).toBe("<p>temporary</p>")
          }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
        )

        // After scope closes, finalizer should have cleared innerHTML
        const app = document.querySelector("#app")
        expect(app?.innerHTML).toBe("")
      }),
    )
  })

  describe("morphdom patching", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="app"></div>`
    })

    afterEach(() => {
      document.body.innerHTML = ""
    })

    it.effect("preserves DOM node identity when only content changes", () =>
      Effect.gen(function* () {
        const sink = yield* DOMSink

        // Render initial content
        yield* sink.render(Stream.make(`<div id="x">old</div>`))
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const app = document.querySelector("#app")
        const originalNode = app?.querySelector("#x")
        expect(originalNode?.textContent).toBe("old")

        // Render updated content — morphdom should patch, not replace
        yield* sink.render(Stream.make(`<div id="x">new</div>`))
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()

        const updatedNode = app?.querySelector("#x")
        expect(updatedNode?.textContent).toBe("new")
        expect(updatedNode).toBe(originalNode)
      }).pipe(Effect.provide(DOMDriverLive), Effect.provide(makeTestConfig("#app"))),
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
