/**
 * Navigation commands accepted by `RouterSink.navigate`.
 *
 * - `push` adds a new history entry.
 * - `replace` replaces the current history entry.
 * - `go` navigates forward or backward by `delta` entries.
 *
 * @since 0.0.1
 */
export type Navigation =
  | { readonly type: "push"; readonly path: string }
  | { readonly type: "replace"; readonly path: string }
  | { readonly type: "go"; readonly delta: number }
