import type * as HttpClientError from "@effect/platform/HttpClientError"
import { Effect, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import { HTTPSource } from "./HTTPSource.js"
import type { HTTPError } from "./errors.js"

/**
 * Wraps an HTTPSource.response stream to decode each response's JSON body
 * through the given Schema. Invalid data becomes a typed ParseError in the
 * stream's error channel.
 */
export const validatedResponse = <A, I>(
  source: HTTPSource["Type"],
  category: string,
  schema: Schema.Schema<A, I>,
): Stream.Stream<A, HTTPError | HttpClientError.ResponseError | ParseError> =>
  source
    .response(category)
    .pipe(
      Stream.mapEffect((response) =>
        response.json.pipe(Effect.flatMap(Schema.decodeUnknown(schema))),
      ),
    )

/**
 * Like validatedResponse but yields the source from context first.
 * Use inside Effect.gen: `const users$ = yield* validatedResponseEffect("users", UserSchema)`
 */
export const validatedResponseEffect = <A, I>(
  category: string,
  schema: Schema.Schema<A, I>,
): Effect.Effect<
  Stream.Stream<A, HTTPError | HttpClientError.ResponseError | ParseError>,
  never,
  HTTPSource
> => Effect.map(HTTPSource, (source) => validatedResponse(source, category, schema))
