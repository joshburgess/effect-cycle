import { Data } from "effect"

export class DriverInitError extends Data.TaggedError("DriverInitError")<{
  readonly driver: string
  readonly cause: unknown
}> {}
