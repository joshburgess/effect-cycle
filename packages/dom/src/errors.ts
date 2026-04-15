import { Data } from "effect"

export class DOMError extends Data.TaggedError("DOMError")<{
  readonly selector: string
  readonly message: string
}> {}
