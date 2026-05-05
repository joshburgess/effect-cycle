/**
 * End-to-end smoke test for the counter-svelte example.
 *
 * Svelte uses ReactiveSink rather than the VDOM-style DOMSink, so the
 * "rendered Chunk" pattern from the other counter smoke tests does not
 * apply. Instead, mount the live ReactiveSinkLive against a jsdom root,
 * feed scripted clicks through TestDOMSource, and poll the real DOM until
 * the count store has propagated to the rendered text node. Catches
 * Svelte-specific renderer wiring.
 */
// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber, Layer } from "effect"
// `app` ends with `sink.mount(...)` which returns synchronously in the
// Svelte renderer (mounts the component + returns). If we let the app
// fiber finish, Effect.provide closes the layer scope and the fromStream
// drainer fork is interrupted before the click can propagate. Wrapping
// with `Effect.andThen(Effect.never)` keeps the scope alive so the smoke
// test can observe the post-click DOM update.
import { DOMConfig } from "effect-cycle-dom"
import { ReactiveSinkLive } from "effect-cycle-svelte"
import { TestDOMSource } from "effect-cycle-testing"
import app from "../src/App.js"

describe("counter-svelte smoke", () => {
  it.effect("composes drivers and updates the DOM after a click", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        document.body.innerHTML = `<div id="app"></div>`
      })

      const domSourceLayer = TestDOMSource({ ".increment": [new Event("click")] })
      const configLayer = Layer.succeed(DOMConfig, { rootSelector: "#app" })
      const layers = Layer.mergeAll(domSourceLayer, Layer.provide(ReactiveSinkLive, configLayer))

      const fiber = yield* Effect.fork(
        app.pipe(Effect.andThen(Effect.never), Effect.provide(layers)),
      )

      // Poll INSIDE the fiber's lifetime; interrupting the fiber closes
      // the layer scope which unmounts the Svelte component and clears the
      // rendered DOM. So capture observed-during-polling and assert after,
      // then interrupt for cleanup.
      const MAX_YIELDS = 500
      let ticks = 0
      let observed = ""
      while (ticks < MAX_YIELDS) {
        const text = yield* Effect.sync(() => document.querySelector("#app")?.textContent ?? "")
        if (text.includes("Count: 1")) {
          observed = text
          break
        }
        yield* Effect.yieldNow()
        ticks += 1
      }

      yield* Fiber.interrupt(fiber)

      expect(observed).toContain("Count: 1")

      yield* Effect.sync(() => {
        document.body.innerHTML = ""
      })
    }),
  )
})
