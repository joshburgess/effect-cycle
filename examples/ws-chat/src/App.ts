/**
 * WebSocket Chat example — real-time bidirectional messaging.
 *
 * Demonstrates the WSSource/WSSink cycle:
 *   1. WSSource.connected awaits the WebSocket handshake before proceeding
 *   2. Incoming WSSource.messages are accumulated in a Ref<Array<string>>
 *   3. Form submit events from DOMSource trigger outgoing sends via WSSink.send
 *   4. DOMSink renders the message list and input form after every state change
 *
 * The WebSocket URL is supplied by the WSConfig layer in main.ts — the app
 * itself never hard-codes infrastructure details.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"
import { WSSink, WSSource } from "effect-cycle-ws"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  const ws = yield* WSSource
  const wsSink = yield* WSSink

  // Wait until the WebSocket connection is established before reading or sending.
  // WSSource.connected is an Effect<void, WSError> that resolves on the "open" event.
  yield* ws.connected

  // Accumulate all received messages in a mutable Ref.
  // Starting with an empty list — messages are prepended as they arrive.
  const messages = yield* Ref.make<ReadonlyArray<string>>([])

  // Stream.runForEach drains the message stream; we run it in the background
  // with Effect.fork so the main fiber can continue setting up DOM interactions.
  yield* ws.messages.pipe(
    Stream.mapEffect((event) =>
      // MessageEvent.data may be a string or binary — we treat it as a string here.
      Ref.update(messages, (msgs) => [...msgs, event.data as string]),
    ),
    Stream.runDrain,
    // Fork so message accumulation runs concurrently with outgoing sends and rendering.
    Effect.fork,
  )

  // dom.select(".send-btn", "click") gives a Stream<Event> of click events on the send button.
  // We use mapEffect + Effect.sync to safely read DOM state.
  const outgoing$ = dom.select(".send-btn", "click").pipe(
    Stream.mapEffect((event) =>
      Effect.sync(() => {
        // Walk up from the button to the nearest form to find the input.
        const form = (event.target as HTMLElement).closest("form") as HTMLFormElement | null
        const input = form?.querySelector(".chat-input") as HTMLInputElement | null
        const value = input?.value ?? ""

        // Clear the input after reading so the field resets after sending.
        if (input !== null) {
          input.value = ""
        }

        return value
      }),
    ),
    // Ignore empty sends.
    Stream.filter((msg) => msg.length > 0),
  )

  // WSSink.send consumes a Stream<string | ArrayBuffer> and writes each value to the socket.
  // This forks internally so we don't block waiting for the stream to complete.
  yield* wsSink.send(outgoing$)

  // Re-render on every new DOM event (both incoming messages and send clicks).
  // We merge the event streams so any activity triggers a fresh render pass.
  // WSError is handled by Stream.orElse — on disconnect the message stream ends
  // and we fall through to an empty stream, keeping the trigger$ alive via outgoing$.
  const wsEvents$ = ws.messages.pipe(
    Stream.map((): void => undefined),
    // If the WebSocket disconnects with an error, gracefully end this branch.
    Stream.orElse(() => Stream.empty),
  )

  const sendEvents$ = outgoing$.pipe(Stream.map((): void => undefined))

  const trigger$ = Stream.mergeAll([wsEvents$, sendEvents$], { concurrency: "unbounded" })

  const vdom$ = trigger$.pipe(
    Stream.mapEffect(() => Ref.get(messages)),
    Stream.map((msgs) => {
      const items = msgs.map((m) => `<li class="message">${m}</li>`).join("")

      return `<div class="chat">
        <ul class="message-list">${items}</ul>
        <form class="chat-form">
          <input class="chat-input" type="text" placeholder="Type a message…" />
          <button class="send-btn" type="button">Send</button>
        </form>
      </div>`
    }),
  )

  yield* sink.render(vdom$)
})

export default app
