/**
 * HTTP Search example: debounced search with reactive HTTP requests.
 *
 * Demonstrates the HTTPSink/HTTPSource cycle:
 *   1. User input events flow through DOMSource
 *   2. Debounced keystrokes are mapped to HttpClientRequest values
 *   3. HTTPSink.request dispatches them (keyed by category "search")
 *   4. HTTPSource.response("search") streams back the responses
 *   5. DOMSink renders the response body as a tachys VNode tree
 *
 * The HTTP driver uses a PubSub internally to correlate requests → responses
 * by category, making it easy to have multiple independent request streams.
 */
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Effect, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { HTTPSink, HTTPSource } from "effect-cycle-http"
import { DOMSink, type VNode } from "effect-cycle-tachys"
import { h } from "tachys/sync"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink

  // HTTPSink dispatches streams of HttpClientRequest values, grouped by category.
  // HTTPSource.response(category) gives back a stream of the corresponding responses.
  const http = yield* HTTPSink
  const httpSource = yield* HTTPSource

  // Listen to keyup events on the search input.
  // dom.select returns a Stream<Event> scoped to the driver's root element.
  const keyup$ = dom.select(".search-input", "keyup")

  // Transform the raw event stream into a stream of request objects:
  //   1. Extract the typed value from the input element
  //   2. Debounce to avoid a request on every keystroke
  //   3. Map each value to a GET request
  const req$ = keyup$.pipe(
    Stream.mapEffect((event) =>
      Effect.sync(() => {
        const input = event.target as HTMLInputElement
        return input.value
      }),
    ),
    // Only fire a request if the user pauses typing for 300 ms.
    Stream.debounce("300 millis"),
    Stream.map((value) => HttpClientRequest.get(`/api/search?q=${encodeURIComponent(value)}`)),
  )

  // Register the request stream with the HTTP driver under the "search" category.
  // This Effect forks internally; it does not block the current fiber.
  yield* http.request("search", req$)

  // HTTPSource.response gives a Stream<HttpClientResponse> for the category;
  // failures are surfaced separately via httpSource.errors(category).
  // The server returns raw HTML for the result list, so we embed it via
  // dangerouslySetInnerHTML rather than trying to model it as a VNode tree.
  const success$: Stream.Stream<VNode> = httpSource.response("search").pipe(
    Stream.mapEffect((response) =>
      // .text is an Effect<string, ResponseError> defined on HttpIncomingMessage.
      response.text.pipe(
        Effect.map((body) =>
          h(
            "div",
            { className: "results" },
            h("ul", { dangerouslySetInnerHTML: { __html: body } }),
          ),
        ),
        // On body-read error, render a friendly message.
        Effect.orElse(() =>
          Effect.succeed(
            h(
              "div",
              { className: "results error" },
              "Could not read response body. Please try again.",
            ),
          ),
        ),
      ),
    ),
  )

  // Render an error message whenever the driver reports a failure.
  const errors$: Stream.Stream<VNode> = httpSource
    .errors("search")
    .pipe(
      Stream.map((err) =>
        h(
          "div",
          { className: "results error" },
          `Search request failed (status ${err.status}). Please try again.`,
        ),
      ),
    )

  const results$ = Stream.mergeAll([success$, errors$], { concurrency: 2 })

  // Render the result stream.  Each new response overwrites the previous output.
  yield* sink.render(results$)
})

export default app
