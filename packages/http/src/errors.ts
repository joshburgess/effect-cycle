import { Data } from "effect"

export class HTTPError extends Data.TaggedError("HTTPError")<{
  readonly status: number
  readonly body: string
  readonly url: string
}> {}
