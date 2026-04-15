import { Context, Effect, Layer } from "effect"

export class DOMConfig extends Context.Tag("effect-cycle/DOMConfig")<
  DOMConfig,
  { readonly rootSelector: string }
>() {}

export const DOMConfigDefault = Layer.succeed(DOMConfig, { rootSelector: "#app" })
