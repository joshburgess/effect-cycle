// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Queue, Stream } from "effect"
import { DOMConfig, DOMError, DOMSource } from "effect-cycle-dom"
import { ReactiveDriverLive, ReactiveSink } from "effect-cycle-svelte"

const makeTestConfig = (selector: string) => Layer.succeed(DOMConfig, { rootSelector: selector })

describe("ReactiveDriverLive (svelte)", () => {
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

    it.effect(
      "fromStream bridges Stream emissions into a Svelte writable store seen through Readable",
      () =>
        Effect.gen(function* () {
          const sink = yield* ReactiveSink

          // A queue-driven stream so the test can deterministically push values.
          const queue = yield* Queue.unbounded<number>()
          const store = yield* sink.fromStream(Stream.fromQueue(queue), 0)

          // Collect updates from store.subscribe so we can assert deterministically.
          const updates: number[] = []
          const unsub = store.subscribe((v) => {
            updates.push(v)
          })

          // The initial subscribe call delivers the seed value synchronously.
          expect(updates).toEqual([0])

          // Push values, give the forked fiber a tick to drain.
          yield* Queue.offer(queue, 1)
          yield* Effect.yieldNow()
          yield* Effect.yieldNow()
          expect(updates).toEqual([0, 1])

          yield* Queue.offer(queue, 42)
          yield* Effect.yieldNow()
          yield* Effect.yieldNow()
          expect(updates).toEqual([0, 1, 42])

          unsub()
        }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
    )

    it.effect("fromStream-backed store stops receiving updates after the sink scope closes", () =>
      Effect.gen(function* () {
        const queue = yield* Queue.unbounded<number>()
        const updates: number[] = []
        let unsub: (() => void) | undefined

        yield* Effect.scoped(
          Effect.gen(function* () {
            const sink = yield* ReactiveSink
            const store = yield* sink.fromStream(Stream.fromQueue(queue), 0)
            unsub = store.subscribe((v) => {
              updates.push(v)
            })

            yield* Queue.offer(queue, 1)
            yield* Effect.yieldNow()
            yield* Effect.yieldNow()
          }).pipe(Effect.provide(ReactiveDriverLive), Effect.provide(makeTestConfig("#app"))),
        )

        // Inside the scope we observed the seed and the first emission.
        expect(updates).toEqual([0, 1])

        // After the scope closes, the forked fiber is interrupted; further offers
        // should not push into the store.
        yield* Queue.offer(queue, 99)
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()
        expect(updates).toEqual([0, 1])

        unsub?.()
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
