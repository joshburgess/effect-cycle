/**
 * Route location and path-matching utilities.
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
 * Pattern syntax: "/articles/:slug/comments/:id"
 * Returns extracted params or undefined if no match.
 *
 * Supports:
 *   - Exact segments: "/foo" matches "/foo"
 *   - Named params: "/:id" captures the segment as "id"
 *   - Trailing segments are ignored when the pattern ends (prefix matching)
 *     is NOT done -- the match must be exact.
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
 * Parse query string into a record.
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
