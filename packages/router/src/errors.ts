import { Data } from "effect"

export class RouterError extends Data.TaggedError("RouterError")<{
  readonly message: string
}> {}
