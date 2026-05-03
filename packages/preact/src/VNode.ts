import type { JSX } from "preact"

/**
 * A virtual DOM node for the Preact renderer: a Preact JSX element produced
 * by the `h(...)` factory or by JSX. Aliased to `JSX.Element` so that
 * concrete `h(tag, props, ...)` call sites with element-specific props are
 * assignable without fighting `VNode<P>`'s invariance in `P`.
 *
 * @since 0.1.0
 */
export type VNode = JSX.Element
