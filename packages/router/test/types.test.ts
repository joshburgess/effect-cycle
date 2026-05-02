import type { Effect, Stream } from "effect"
import {
  type Navigation,
  type RouteLocation,
  RouterError,
  type RouterSink,
  type RouterSource,
  matchPath,
  parseQuery,
} from "effect-cycle-router"
import { describe, expectTypeOf, it } from "vitest"

// -------------------------------------------------------------------------------------
// matchPath / parseQuery
// -------------------------------------------------------------------------------------

describe("matchPath / parseQuery types", () => {
  it("matchPath returns Record<string, string> | undefined", () => {
    expectTypeOf(matchPath).toEqualTypeOf<
      (pattern: string, path: string) => Record<string, string> | undefined
    >()
  })

  it("parseQuery returns Record<string, string>", () => {
    expectTypeOf(parseQuery).toEqualTypeOf<(search: string) => Record<string, string>>()
  })
})

// -------------------------------------------------------------------------------------
// RouteLocation / Navigation shape
// -------------------------------------------------------------------------------------

describe("RouteLocation type", () => {
  it("has path, query, and hash", () => {
    expectTypeOf<RouteLocation>().toEqualTypeOf<{
      readonly path: string
      readonly query: Readonly<Record<string, string>>
      readonly hash: string
    }>()
  })
})

describe("Navigation type", () => {
  it("is a discriminated union of push | replace | go", () => {
    expectTypeOf<Navigation>().toEqualTypeOf<
      | { readonly type: "push"; readonly path: string }
      | { readonly type: "replace"; readonly path: string }
      | { readonly type: "go"; readonly delta: number }
    >()
  })
})

// -------------------------------------------------------------------------------------
// RouterSource / RouterSink shape
// -------------------------------------------------------------------------------------

describe("RouterSource type", () => {
  it("location$ is Stream<RouteLocation>", () => {
    const get = (s: RouterSource["Type"]) => s.location$
    expectTypeOf(get).returns.toEqualTypeOf<Stream.Stream<RouteLocation>>()
  })

  it("currentLocation is Effect<RouteLocation>", () => {
    const get = (s: RouterSource["Type"]) => s.currentLocation
    expectTypeOf(get).returns.toEqualTypeOf<Effect.Effect<RouteLocation>>()
  })

  it("matchPath$ returns Stream of decoded params", () => {
    const call = (s: RouterSource["Type"]) => s.matchPath$("/articles/:slug")
    expectTypeOf(call).returns.toEqualTypeOf<Stream.Stream<Readonly<Record<string, string>>>>()
  })
})

describe("RouterSink type", () => {
  it("navigate accepts a stream of Navigation", () => {
    const call = (s: RouterSink["Type"], n$: Stream.Stream<Navigation>) => s.navigate(n$)
    expectTypeOf(call).returns.toEqualTypeOf<Effect.Effect<void>>()
  })

  it("push and replace can fail with RouterError", () => {
    const push = (s: RouterSink["Type"]) => s.push("/foo")
    const replace = (s: RouterSink["Type"]) => s.replace("/foo")
    expectTypeOf(push).returns.toEqualTypeOf<Effect.Effect<void, RouterError>>()
    expectTypeOf(replace).returns.toEqualTypeOf<Effect.Effect<void, RouterError>>()
  })
})

// -------------------------------------------------------------------------------------
// RouterError shape
// -------------------------------------------------------------------------------------

describe("RouterError type", () => {
  it("has _tag and message", () => {
    const make = (message: string) => new RouterError({ message })
    expectTypeOf(make).returns.toMatchTypeOf<{
      readonly _tag: "RouterError"
      readonly message: string
    }>()
  })
})
