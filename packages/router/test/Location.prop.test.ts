/**
 * Property-based tests for matchPath and parseQuery using fast-check.
 */
import { describe, expect, it } from "@effect/vitest"
import * as fc from "fast-check"
import { matchPath, parseQuery } from "effect-cycle-router"

// ---------------------------------------------------------------------------
// Arbitraries (fast-check v4 API)
// ---------------------------------------------------------------------------

/** A URL-safe segment (alphanumeric, 1-20 chars). */
const segmentArb = fc.stringMatching(/^[a-zA-Z0-9\-_]{1,20}$/)

/** A param name (alpha only). */
const paramNameArb = fc.stringMatching(/^[a-zA-Z]{1,10}$/)

/** A path made of 1-5 literal segments. */
const literalPathArb = fc
  .array(segmentArb, { minLength: 1, maxLength: 5 })
  .map((segs) => `/${segs.join("/")}`)

/** A query key (alphanumeric). */
const queryKeyArb = fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/)

/** A query value (alphanumeric + spaces). */
const queryValueArb = fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/)

// ---------------------------------------------------------------------------
// matchPath properties
// ---------------------------------------------------------------------------

describe("matchPath (property-based)", () => {
  it("exact literal path always matches itself", () => {
    fc.assert(
      fc.property(literalPathArb, (path) => {
        const result = matchPath(path, path)
        expect(result).toEqual({})
      }),
    )
  })

  it("different literal paths never match", () => {
    fc.assert(
      fc.property(literalPathArb, literalPathArb, (a, b) => {
        fc.pre(a !== b)
        expect(matchPath(a, b)).toBeUndefined()
      }),
    )
  })

  it("a parameterized pattern captures the segment value", () => {
    fc.assert(
      fc.property(paramNameArb, segmentArb, (name, value) => {
        const pattern = `/:${name}`
        const path = `/${value}`
        const result = matchPath(pattern, path)
        expect(result).toBeDefined()
        expect(result![name]).toBe(decodeURIComponent(value))
      }),
    )
  })

  it("captures multiple params in order", () => {
    fc.assert(
      fc.property(
        paramNameArb,
        paramNameArb,
        segmentArb,
        segmentArb,
        (nameA, nameB, valA, valB) => {
          fc.pre(nameA !== nameB)
          const pattern = `/:${nameA}/:${nameB}`
          const path = `/${valA}/${valB}`
          const result = matchPath(pattern, path)
          expect(result).toBeDefined()
          expect(result![nameA]).toBe(decodeURIComponent(valA))
          expect(result![nameB]).toBe(decodeURIComponent(valB))
        },
      ),
    )
  })

  it("rejects when segment count differs", () => {
    fc.assert(
      fc.property(
        fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
        segmentArb,
        (segs, extra) => {
          const pattern = `/${segs.join("/")}`
          const longerPath = `/${segs.join("/")}/${extra}`
          expect(matchPath(pattern, longerPath)).toBeUndefined()
        },
      ),
    )
  })

  it("mixed literal and param segments work together", () => {
    fc.assert(
      fc.property(segmentArb, paramNameArb, segmentArb, (literal, name, value) => {
        const pattern = `/${literal}/:${name}`
        const goodPath = `/${literal}/${value}`
        const result = matchPath(pattern, goodPath)
        expect(result).toBeDefined()
        expect(result![name]).toBe(decodeURIComponent(value))
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// parseQuery properties
// ---------------------------------------------------------------------------

describe("parseQuery (property-based)", () => {
  it("roundtrips a single key-value pair", () => {
    fc.assert(
      fc.property(queryKeyArb, queryValueArb, (key, value) => {
        const qs = `?${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        const result = parseQuery(qs)
        expect(result[key]).toBe(value)
      }),
    )
  })

  it("roundtrips multiple key-value pairs", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(queryKeyArb, queryValueArb), { minLength: 1, maxLength: 5 }),
        (pairs) => {
          // Deduplicate keys (last wins in parseQuery, but for roundtrip we need unique)
          const uniquePairs = new Map(pairs)
          fc.pre(uniquePairs.size > 0)
          const qs = `?${[...uniquePairs.entries()]
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&")}`
          const result = parseQuery(qs)
          for (const [k, v] of uniquePairs) {
            expect(result[k]).toBe(v)
          }
        },
      ),
    )
  })

  it("empty string always produces empty object", () => {
    fc.assert(
      fc.property(fc.constant(""), (s) => {
        expect(parseQuery(s)).toEqual({})
      }),
    )
  })

  it("key without value gets empty string", () => {
    fc.assert(
      fc.property(queryKeyArb, (key) => {
        const qs = `?${encodeURIComponent(key)}`
        const result = parseQuery(qs)
        expect(result[key]).toBe("")
      }),
    )
  })

  it("with or without leading ? produces the same result", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(queryKeyArb, queryValueArb), { minLength: 1, maxLength: 3 }),
        (pairs) => {
          const uniquePairs = new Map(pairs)
          fc.pre(uniquePairs.size > 0)
          const body = [...uniquePairs.entries()]
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&")
          expect(parseQuery(`?${body}`)).toEqual(parseQuery(body))
        },
      ),
    )
  })
})
