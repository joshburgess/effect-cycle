import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
/**
 * HTTP Search example — debounced search with reactive HTTP requests.
 *
 * Demonstrates the HTTPSink/HTTPSource cycle:
 *   1. User input events flow through DOMSource
 *   2. Debounced keystrokes are mapped to HttpClientRequest values
 *   3. HTTPSink.request dispatches them (keyed by category "search")
 *   4. HTTPSource.response("search") streams back the responses
 *   5. DOMSink renders the response body as HTML
 *
 * The HTTP driver uses a PubSub internally to correlate requests → responses
 * by category, making it easy to have multiple independent request streams.
 */
import { Effect, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { HTTPSink, HTTPSource } from "effect-cycle-http"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink

  // HTTPSink dispatches streams of HttpClientRequest values, grouped by category.
  // HTTPSource.response(category) gives back a stream of the corresponding responses.
  const http = yield* HTTPSink
  const httpSource = yield* HTTPSource

  // Listen to keyup events on the search input.
  // dom.select returns a Stream<Event> scoped to the driver's root element.
  const keyup$ = dom.select(".search-input")

  // Transform the raw event stream into a stream of request objects:
  //   1. Extract the typed value from the input element
  //   2. Debounce to avoid a request on every keystroke
  //   3. Map each value to a GET request
  const req$ = keyup$.pipe(
    Stream.map((event) => {
      // The DOM gives us a generic Event; we cast to access .value.
      const input = event.target as HTMLInputElement
      return input.value
    }),
    // Only fire a request if the user pauses typing for 300 ms.
    Stream.debounce("300 millis"),
    Stream.map((value) => HttpClientRequest.get(`/api/search?q=${encodeURIComponent(value)}`)),
  )

  // Register the request stream with the HTTP driver under the "search" category.
  // This Effect forks internally — it does not block the current fiber.
  yield* http.request("search", req$)

  // HTTPSource.response gives a Stream<HttpClientResponse, HTTPError> for the category.
  // Stream.mapEffect lets us run an Effect per response (reading the text body).
  // We handle errors at both levels:
  //   - response.text errors (ResponseError) are caught with Effect.orElse
  //   - HTTPError from the stream itself is caught with Stream.catchAll
  const results$ = httpSource.response("search").pipe(
    Stream.mapEffect((response) =>
      // .text is an Effect<string, ResponseError> defined on HttpIncomingMessage.
      response.text.pipe(
        Effect.map(
          (body) =>
            `<div class="results">
              <ul>${body}</ul>
            </div>`,
        ),
        // On body-read error, render a friendly message.
        Effect.orElse(() =>
          Effect.succeed(
            `<div class="results error">Could not read response body. Please try again.</div>`,
          ),
        ),
      ),
    ),
    // HTTPError (network failure, non-2xx status) stops the stream — recover to keep it alive.
    Stream.catchAll(() =>
      Stream.make(`<div class="results error">Search request failed. Please try again.</div>`),
    ),
  )

  // Render the result stream.  Each new response overwrites the previous output.
  yield* sink.render(results$)
})

export default app
