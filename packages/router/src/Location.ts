/**
 * Route location and path-matching utilities.
 *
 * @module
 */

/**
 * Represents a parsed route location.
 *
 * @since 0.1.0
 */
export interface RouteLocation {
  /** The full path (without hash prefix or base). e.g. "/articles/my-slug" */
  readonly path: string
  /** Parsed query parameters. */
  readonly query: Readonly<Record<string, string>>
  /** The raw hash fragment (empty string if none). */
  readonly hash: string
}

/**
 * Match a path against a pattern with named parameters.
 *
 * Returns extracted params as a record, or `undefined` if the path
 * does not match.
 *
 * Supports exact segments (`/foo`) and named params (`/:id`).
 * Matching is exact -- trailing segments cause a mismatch.
 *
 * @param pattern - Route pattern (e.g. `"/articles/:slug/comments/:id"`).
 * @param path - The actual URL path to match against.
 * @returns A record of extracted parameters, or `undefined`.
 *
 * @example
 * ```ts
 * matchPath("/articles/:slug", "/articles/hello-world")
 * // => { slug: "hello-world" }
 *
 * matchPath("/articles/:slug", "/users/42")
 * // => undefined
 * ```
 *
 * @since 0.1.0
 */
export const matchPath = (pattern: string, path: string): Record<string, string> | undefined => {
  const patternParts = pattern.split("/").filter((s) => s.length > 0)
  const pathParts = path.split("/").filter((s) => s.length > 0)

  if (patternParts.length !== pathParts.length) return undefined

  const params: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i]!
    const seg = pathParts[i]!
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(seg)
    } else if (pat !== seg) {
      return undefined
    }
  }

  return params
}

/**
 * Parse a query string into a key-value record.
 *
 * Handles both `"?key=value"` and `"key=value"` formats.
 * Keys without values get an empty string.
 *
 * @param search - The query string to parse.
 * @returns A record of decoded key-value pairs.
 *
 * @since 0.1.0
 */
export const parseQuery = (search: string): Record<string, string> => {
  const result: Record<string, string> = {}
  const cleaned = search.startsWith("?") ? search.slice(1) : search
  if (cleaned.length === 0) return result
  for (const pair of cleaned.split("&")) {
    const idx = pair.indexOf("=")
    if (idx === -1) {
      result[decodeURIComponent(pair)] = ""
    } else {
      result[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1))
    }
  }
  return result
}
