import { Effect, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import { WSSource } from "./WSSource.js"
import type { WSError } from "./errors.js"

/**
 * Wraps a `WSSource.messages` stream to decode each `MessageEvent`'s `data`
 * field through the given `Schema`. Invalid data becomes a typed `ParseError`
 * in the stream's error channel.
 *
 * @example
 * ```ts
 * const ChatMessage = Schema.Struct({ user: Schema.String, text: Schema.String })
 * const messages$ = validatedMessage(ws, ChatMessage)
 * ```
 *
 * @since 0.1.0
 */
export const validatedMessage = <A, I>(
  source: WSSource["Type"],
  schema: Schema.Schema<A, I>,
): Stream.Stream<A, WSError | ParseError> =>
  source.messages.pipe(Stream.mapEffect((event) => Schema.decodeUnknown(schema)(event.data)))

/**
 * Like {@link validatedMessage} but yields the source from context first.
 *
 * Use inside `Effect.gen`:
 * ```ts
 * const data$ = yield* validatedMessageEffect(MySchema)
 * ```
 *
 * @since 0.1.0
 */
export const validatedMessageEffect = <A, I>(
  schema: Schema.Schema<A, I>,
): Effect.Effect<Stream.Stream<A, WSError | ParseError>, never, WSSource> =>
  Effect.map(WSSource, (source) => validatedMessage(source, schema))
