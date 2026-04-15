import { Data } from "effect"

export class WSError extends Data.TaggedError("WSError")<{
  readonly url: string
  readonly code?: number
  readonly reason?: string
}> {}
