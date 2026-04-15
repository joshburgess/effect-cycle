import { Context, type Effect, type Stream } from "effect"

export class WSSink extends Context.Tag("effect-cycle/WSSink")<
  WSSink,
  {
    readonly send: (msg$: Stream.Stream<string | ArrayBuffer>) => Effect.Effect<void>
  }
>() {}
