import type { ReactElement } from "react"

/**
 * A virtual DOM node for the React renderer: a `ReactElement` produced by
 * `React.createElement` (or JSX). `ReactElement` defaults its props
 * generic to `any`, so concrete `createElement(tag, props, ...)` call sites
 * are assignable without invariance friction.
 *
 * @since 0.1.0
 */
export type VNode = ReactElement
