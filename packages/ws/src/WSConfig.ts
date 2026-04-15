import { Context } from "effect"

export class WSConfig extends Context.Tag("effect-cycle/WSConfig")<
  WSConfig,
  {
    readonly url: string
    readonly protocols?: ReadonlyArray<string>
  }
>() {}
