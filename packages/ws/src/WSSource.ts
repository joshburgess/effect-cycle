import { Context, type Effect, type Stream } from "effect"
import type { WSError } from "./errors.js"

export class WSSource extends Context.Tag("effect-cycle/WSSource")<
  WSSource,
  {
    readonly messages: Stream.Stream<MessageEvent, WSError>
    readonly connected: Effect.Effect<void, WSError>
  }
>() {}
