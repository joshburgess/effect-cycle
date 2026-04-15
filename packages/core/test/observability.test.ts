import { describe, expect, it } from "@effect/vitest"
import { Context, Effect, Layer, Metric, Ref } from "effect"
import {
  domEventCount,
  domRenderCount,
  httpErrorCount,
  httpRequestCount,
  instrumentService,
  withEffectSpan,
  wsMessageCount,
  wsSendCount,
} from "effect-cycle-core"

// -------------------------------------------------------------------------------------
// Test service
// -------------------------------------------------------------------------------------

class GreetService extends Context.Tag("effect-cycle/test/GreetService")<
  GreetService,
  {
    readonly greet: (name: string) => Effect.Effect<string>
    readonly ping: Effect.Effect<string>
  }
>() {}

const makeGreetServiceLive = (callLog: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.succeed(GreetService, {
    greet: (name) =>
      Ref.update(callLog, (log) => [...log, `greet:${name}`]).pipe(Effect.as(`Hello, ${name}!`)),
    ping: Ref.update(callLog, (log) => [...log, "ping"]).pipe(Effect.as("pong")),
  })

// -------------------------------------------------------------------------------------
// withEffectSpan
// -------------------------------------------------------------------------------------

describe("withEffectSpan", () => {
  it.effect("wraps a function and the effect runs successfully", () =>
    Effect.gen(function* () {
      const wrapped = withEffectSpan("test.span", (x: number) => Effect.succeed(x * 2))
      const result = yield* wrapped(21)
      expect(result).toBe(42)
    }),
  )

  it.effect("works with multi-arg functions", () =>
    Effect.gen(function* () {
      const add = withEffectSpan("test.add", (a: number, b: number) => Effect.succeed(a + b))
      const result = yield* add(10, 32)
      expect(result).toBe(42)
    }),
  )

  it.effect("propagates errors from the wrapped function", () =>
    Effect.gen(function* () {
      const failing = withEffectSpan("test.fail", (_: undefined) => Effect.fail(new Error("boom")))
      const result = yield* failing(undefined).pipe(
        Effect.catchAll((e) => Effect.succeed(`caught: ${e.message}`)),
      )
      expect(result).toBe("caught: boom")
    }),
  )
})

// -------------------------------------------------------------------------------------
// Metric counters
// -------------------------------------------------------------------------------------

describe("pre-built metric counters", () => {
  it.effect("httpRequestCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(httpRequestCount)
      yield* Metric.increment(httpRequestCount)
      const state = yield* Metric.value(httpRequestCount)
      // The counter may have been incremented by other tests in the same process,
      // so just verify it is at least 2 and is a number.
      expect(state.count).toBeGreaterThanOrEqual(2)
    }),
  )

  it.effect("httpErrorCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(httpErrorCount)
      const state = yield* Metric.value(httpErrorCount)
      expect(state.count).toBeGreaterThanOrEqual(1)
    }),
  )

  it.effect("wsMessageCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(wsMessageCount)
      const state = yield* Metric.value(wsMessageCount)
      expect(state.count).toBeGreaterThanOrEqual(1)
    }),
  )

  it.effect("wsSendCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(wsSendCount)
      const state = yield* Metric.value(wsSendCount)
      expect(state.count).toBeGreaterThanOrEqual(1)
    }),
  )

  it.effect("domEventCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(domEventCount)
      const state = yield* Metric.value(domEventCount)
      expect(state.count).toBeGreaterThanOrEqual(1)
    }),
  )

  it.effect("domRenderCount can be incremented and read", () =>
    Effect.gen(function* () {
      yield* Metric.increment(domRenderCount)
      const state = yield* Metric.value(domRenderCount)
      expect(state.count).toBeGreaterThanOrEqual(1)
    }),
  )
})

// -------------------------------------------------------------------------------------
// instrumentService
// -------------------------------------------------------------------------------------

describe("instrumentService", () => {
  it.effect("calls the wrapper and the original service method", () =>
    Effect.gen(function* () {
      const callLog = yield* Ref.make<ReadonlyArray<string>>([])
      const wrapperLog = yield* Ref.make<ReadonlyArray<string>>([])

      const baseLayer = makeGreetServiceLive(callLog)

      const instrumentedLayer = instrumentService(GreetService, {
        greet: (original) => (name) =>
          Ref.update(wrapperLog, (log) => [...log, `wrapper:greet:${name}`]).pipe(
            Effect.andThen(original(name)),
          ),
      }).pipe(Layer.provide(baseLayer))

      const result = yield* Effect.gen(function* () {
        const svc = yield* GreetService
        return yield* svc.greet("World")
      }).pipe(Effect.provide(instrumentedLayer))

      expect(result).toBe("Hello, World!")

      const calls = yield* Ref.get(callLog)
      const wrapperCalls = yield* Ref.get(wrapperLog)

      expect(calls).toEqual(["greet:World"])
      expect(wrapperCalls).toEqual(["wrapper:greet:World"])
    }),
  )

  it.effect("passes through un-wrapped methods unchanged", () =>
    Effect.gen(function* () {
      const callLog = yield* Ref.make<ReadonlyArray<string>>([])

      const baseLayer = makeGreetServiceLive(callLog)
      // Only wrap `greet`; `ping` should be untouched.
      const instrumentedLayer = instrumentService(GreetService, {
        greet: (original) => (name) => original(name),
      }).pipe(Layer.provide(baseLayer))

      const result = yield* Effect.gen(function* () {
        const svc = yield* GreetService
        return yield* svc.ping
      }).pipe(Effect.provide(instrumentedLayer))

      expect(result).toBe("pong")

      const calls = yield* Ref.get(callLog)
      expect(calls).toEqual(["ping"])
    }),
  )

  it.effect("wraps with withEffectSpan via instrumentService", () =>
    Effect.gen(function* () {
      const callLog = yield* Ref.make<ReadonlyArray<string>>([])

      const baseLayer = makeGreetServiceLive(callLog)
      const instrumentedLayer = instrumentService(GreetService, {
        greet: (original) => withEffectSpan("test.greet", original),
      }).pipe(Layer.provide(baseLayer))

      const result = yield* Effect.gen(function* () {
        const svc = yield* GreetService
        return yield* svc.greet("Effect")
      }).pipe(Effect.provide(instrumentedLayer))

      expect(result).toBe("Hello, Effect!")
    }),
  )
})
