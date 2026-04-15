import type * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { Context } from "effect"
import type { Stream } from "effect"
import type { HTTPError } from "./errors.js"

export class HTTPSource extends Context.Tag("effect-cycle/HTTPSource")<
  HTTPSource,
  {
    readonly response: (
      category: string,
    ) => Stream.Stream<HttpClientResponse.HttpClientResponse, HTTPError>
  }
>() {}
