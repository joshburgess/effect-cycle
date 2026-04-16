/**
 * Navigation commands that the RouterSink accepts.
 */
export type Navigation =
  | { readonly type: "push"; readonly path: string }
  | { readonly type: "replace"; readonly path: string }
  | { readonly type: "go"; readonly delta: number }
