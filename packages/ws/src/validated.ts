import { Effect, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import { WSSource } from "./WSSource.js"
import type { WSError } from "./errors.js"

/**
 * Wraps a WSSource.messages stream to decode each MessageEvent's data field
 * through the given Schema. Invalid data becomes a typed ParseError in the
 * stream's error channel.
 */
export const validatedMessage = <A, I>(
  source: WSSource["Type"],
  schema: Schema.Schema<A, I>,
): Stream.Stream<A, WSError | ParseError> =>
  source.messages.pipe(
    Stream.mapEffect((event) => Schema.decodeUnknown(schema)(event.data)),
  )

/**
 * Like validatedMessage but yields the source from context first.
 * Use inside Effect.gen: `const data$ = yield* validatedMessageEffect(MySchema)`
 */
export const validatedMessageEffect = <A, I>(
  schema: Schema.Schema<A, I>,
): Effect.Effect<Stream.Stream<A, WSError | ParseError>, never, WSSource> =>
  Effect.map(WSSource, (source) => validatedMessage(source, schema))
