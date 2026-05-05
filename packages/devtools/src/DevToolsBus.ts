import { Context, Effect, Layer, PubSub, Stream } from "effect"
import type { DevToolsEvent } from "./DevToolsEvent.js"

/**
 * Programmatic surface for live driver activity.
 *
 * Inspector panels and user-built tooling subscribe to `events` to see
 * driver activity in real time. The instrumentation layers in
 * `effect-cycle-devtools` publish to this bus when
 * `DevToolsConfig.enableEvents` is on. When the flag is off (or the bus
 * is provided as `DevToolsBusNoop`), the publish path is a cheap no-op.
 *
 * The bus is intentionally agnostic about transport: a UI panel can
 * forward the stream over `postMessage`, into a Redux DevTools-style
 * extension, or render it directly. The shape of `DevToolsEvent` is
 * narrow + JSON-friendly so it crosses any of those boundaries safely.
 *
 * @since 0.1.0
 */
export class DevToolsBus extends Context.Tag("effect-cycle/DevToolsBus")<
  DevToolsBus,
  {
    /** Publishes one event. Non-blocking. */
    readonly publish: (event: DevToolsEvent) => Effect.Effect<void>
    /**
     * A stream of every published event. Subscribing creates an
     * independent view over the bus; events published after subscribing
     * are delivered to the subscriber. Events published before are not.
     */
    readonly events: Stream.Stream<DevToolsEvent>
  }
>() {}

/**
 * Live `DevToolsBus` backed by a bounded `PubSub`. Multiple subscribers
 * can read the same events independently.
 *
 * @since 0.1.0
 */
export const DevToolsBusLive: Layer.Layer<DevToolsBus> = Layer.scoped(
  DevToolsBus,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.bounded<DevToolsEvent>(1024)
    return DevToolsBus.of({
      publish: (event) => PubSub.publish(pubsub, event).pipe(Effect.asVoid),
      events: Stream.fromPubSub(pubsub),
    })
  }),
)

/**
 * No-op `DevToolsBus`: `publish` is a no-op and `events` is the empty
 * stream. Use this when you want to wire the instrumentation layers
 * without paying the PubSub cost (e.g. production builds).
 *
 * @since 0.1.0
 */
export const DevToolsBusNoop: Layer.Layer<DevToolsBus> = Layer.succeed(
  DevToolsBus,
  DevToolsBus.of({
    publish: () => Effect.void,
    events: Stream.empty,
  }),
)
