import { Effect, Schema, Stream } from "effect"
import type { ParseError } from "effect/ParseResult"
import { DOMSource } from "./DOMSource.js"

/**
 * Wraps a DOMSource.select stream to extract and decode the `detail` field
 * (for CustomEvent) or the event itself through the given Schema. Useful for
 * validating form submissions and custom events that carry structured data.
 *
 * The extractor function pulls the raw value out of the event before decoding.
 * For CustomEvent: `(e) => (e as CustomEvent).detail`
 * For input events: `(e) => (e.target as HTMLInputElement).value`
 */
export const validatedEvent = <A, I>(
  source: DOMSource["Type"],
  selector: string,
  eventType: string,
  extract: (event: Event) => unknown,
  schema: Schema.Schema<A, I>,
): Stream.Stream<A, ParseError> =>
  source
    .select(selector, eventType)
    .pipe(Stream.mapEffect((event) => Schema.decodeUnknown(schema)(extract(event))))

/**
 * Like validatedEvent but yields the source from context first.
 * Use inside Effect.gen:
 *   `const values$ = yield* validatedEventEffect("form", "submit", extract, MySchema)`
 */
export const validatedEventEffect = <A, I>(
  selector: string,
  eventType: string,
  extract: (event: Event) => unknown,
  schema: Schema.Schema<A, I>,
): Effect.Effect<Stream.Stream<A, ParseError>, never, DOMSource> =>
  Effect.map(DOMSource, (source) => validatedEvent(source, selector, eventType, extract, schema))
