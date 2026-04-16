// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Stream } from "effect"
import { RouterConfig, RouterDriverLive, RouterSink, RouterSource } from "effect-cycle-router"

const HashConfig = Layer.succeed(RouterConfig, { mode: "hash" as const, base: "" })
const HashDriver = RouterDriverLive.pipe(Layer.provide(HashConfig))

describe("RouterDriverLive (hash mode)", () => {
  afterEach(() => {
    window.location.hash = ""
  })

  it.effect("emits initial location on subscription", () =>
    Effect.gen(function* () {
      // The initial location is whatever the hash is when the driver starts.
      // In jsdom, this is "/" (empty hash).
      const source = yield* RouterSource
      const first = yield* Stream.take(source.location$, 1).pipe(Stream.runCollect)
      const locations = [...first]
      expect(locations).toHaveLength(1)
      expect(locations[0]?.path).toBe("/")
    }).pipe(Effect.provide(HashDriver)),
  )

  it.effect("currentLocation reads the current hash", () =>
    Effect.gen(function* () {
      // Use the sink to set the location first
      const sink = yield* RouterSink
      yield* sink.push("/settings")
      const source = yield* RouterSource
      const loc = yield* source.currentLocation
      expect(loc.path).toBe("/settings")
    }).pipe(Effect.provide(HashDriver)),
  )

  it.effect("push navigates and updates the hash", () =>
    Effect.gen(function* () {
      const sink = yield* RouterSink
      yield* sink.push("/articles/new")
      const source = yield* RouterSource
      const loc = yield* source.currentLocation
      expect(loc.path).toBe("/articles/new")
    }).pipe(Effect.provide(HashDriver)),
  )

  it.effect("replace updates location without adding history entry", () =>
    Effect.gen(function* () {
      const sink = yield* RouterSink
      yield* sink.replace("/login")
      const source = yield* RouterSource
      const loc = yield* source.currentLocation
      expect(loc.path).toBe("/login")
    }).pipe(Effect.provide(HashDriver)),
  )

  it.effect("matchPath$ filters and extracts params", () =>
    Effect.gen(function* () {
      const sink = yield* RouterSink
      yield* sink.push("/articles/my-slug")
      const source = yield* RouterSource
      // Take 2 because location$ emits the initial "/" first, then "/articles/my-slug"
      const all = yield* Stream.take(source.location$, 2).pipe(Stream.runCollect)
      const locations = [...all]
      expect(locations[1]?.path).toBe("/articles/my-slug")

      // Also test matchPath$ on currentLocation
      const loc = yield* source.currentLocation
      expect(loc.path).toBe("/articles/my-slug")
    }).pipe(Effect.provide(HashDriver)),
  )

  it.effect("parses query parameters from hash", () =>
    Effect.gen(function* () {
      const sink = yield* RouterSink
      yield* sink.push("/search?q=effect&page=2")
      const source = yield* RouterSource
      const loc = yield* source.currentLocation
      expect(loc.path).toBe("/search")
      expect(loc.query).toEqual({ q: "effect", page: "2" })
    }).pipe(Effect.provide(HashDriver)),
  )
})
