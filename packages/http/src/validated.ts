import type * as HttpClientError from "@effect/platform/HttpClientError"
import { Effect, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import { HTTPSource } from "./HTTPSource.js"

/**
 * Wraps an `HTTPSource.response` stream to decode each response's JSON body
 * through the given `Schema`. Invalid data becomes a typed `ParseError` in the
 * stream's error channel. Transport failures are not emitted here; subscribe
 * to `HTTPSource.errors(category)` for those.
 *
 * @example
 * ```ts
 * const UserSchema = Schema.Struct({ id: Schema.String, name: Schema.String })
 * const users$ = validatedResponse(http, "users", UserSchema)
 * ```
 *
 * @since 0.1.0
 */
export const validatedResponse = <A, I>(
  source: HTTPSource["Type"],
  category: string,
  schema: Schema.Schema<A, I>,
): Stream.Stream<A, HttpClientError.ResponseError | ParseError> =>
  source
    .response(category)
    .pipe(
      Stream.mapEffect((response) =>
        response.json.pipe(Effect.flatMap(Schema.decodeUnknown(schema))),
      ),
    )

/**
 * Like {@link validatedResponse} but yields the source from context first.
 *
 * Use inside `Effect.gen`:
 * ```ts
 * const users$ = yield* validatedResponseEffect("users", UserSchema)
 * ```
 *
 * @since 0.1.0
 */
export const validatedResponseEffect = <A, I>(
  category: string,
  schema: Schema.Schema<A, I>,
): Effect.Effect<Stream.Stream<A, HttpClientError.ResponseError | ParseError>, never, HTTPSource> =>
  Effect.map(HTTPSource, (source) => validatedResponse(source, category, schema))
