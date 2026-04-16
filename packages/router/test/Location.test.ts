import { describe, expect, it } from "@effect/vitest"
import { matchPath, parseQuery } from "effect-cycle-router"

describe("matchPath", () => {
  it("matches exact paths", () => {
    expect(matchPath("/", "/")).toEqual({})
    expect(matchPath("/foo", "/foo")).toEqual({})
    expect(matchPath("/foo/bar", "/foo/bar")).toEqual({})
  })

  it("rejects non-matching paths", () => {
    expect(matchPath("/foo", "/bar")).toBeUndefined()
    expect(matchPath("/foo/bar", "/foo")).toBeUndefined()
    expect(matchPath("/foo", "/foo/bar")).toBeUndefined()
  })

  it("extracts named parameters", () => {
    expect(matchPath("/articles/:slug", "/articles/hello-world")).toEqual({
      slug: "hello-world",
    })
    expect(matchPath("/users/:id/posts/:postId", "/users/42/posts/7")).toEqual({
      id: "42",
      postId: "7",
    })
  })

  it("decodes URI components in parameters", () => {
    expect(matchPath("/search/:query", "/search/hello%20world")).toEqual({
      query: "hello world",
    })
  })

  it("rejects partial matches", () => {
    expect(matchPath("/articles/:slug", "/articles")).toBeUndefined()
    expect(matchPath("/articles", "/articles/extra")).toBeUndefined()
  })
})

describe("parseQuery", () => {
  it("parses empty string", () => {
    expect(parseQuery("")).toEqual({})
    expect(parseQuery("?")).toEqual({})
  })

  it("parses key-value pairs", () => {
    expect(parseQuery("?foo=bar&baz=qux")).toEqual({ foo: "bar", baz: "qux" })
    expect(parseQuery("foo=bar&baz=qux")).toEqual({ foo: "bar", baz: "qux" })
  })

  it("handles keys without values", () => {
    expect(parseQuery("?flag")).toEqual({ flag: "" })
  })

  it("decodes URI components", () => {
    expect(parseQuery("?q=hello%20world")).toEqual({ q: "hello world" })
  })
})
