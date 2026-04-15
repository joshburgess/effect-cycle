import type * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Context } from "effect"
import type { Effect, Stream } from "effect"

export class HTTPSink extends Context.Tag("effect-cycle/HTTPSink")<
  HTTPSink,
  {
    readonly request: (
      category: string,
      req$: Stream.Stream<HttpClientRequest.HttpClientRequest>,
    ) => Effect.Effect<void>
  }
>() {}
