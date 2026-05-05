# effect-cycle-devtools

Driver instrumentation layers for [effect-cycle](https://github.com/joshburgess/effect-cycle): logging, metrics, OpenTelemetry spans, and an opt-in event bus that streams structured driver-activity events for inspector panels.

## Install

```sh
pnpm add effect-cycle-devtools effect-cycle-core effect
```

## What's in the box

- `DevToolsConfig` / `DevToolsConfigDefault` — toggle `logLevel`, `enableMetrics`, `enableSpans`, `enableEvents`.
- `DevToolsBus` (Tag) with `DevToolsBusLive` (PubSub-backed) and `DevToolsBusNoop` (drops publishes). Subscribers consume `bus.events: Stream.Stream<DevToolsEvent>`.
- `DevToolsEvent` — tagged union of 10 event variants (`DOMEvent`, `DOMRender`, `HTTPRequest`, `HTTPResponse`, `HTTPRequestError`, `WSMessageReceived`, `WSMessageSent`, `RouterNavigation`, `RouterPush`, `RouterReplace`).
- `instrumentDOM(tag)`, `instrumentHTTP`, `instrumentWS`, `instrumentRouter` — per-driver instrumentation layers.
- `DevToolsLayer(tag)` — convenience layer that instruments every driver.

## Usage

```ts
import { Effect, Layer } from "effect"
import {
  DevToolsBusNoop,
  DevToolsConfigDefault,
  DevToolsLayer,
} from "effect-cycle-devtools"
import { DOMSink, DOMDriverLive } from "effect-cycle-morphdom"

const Drivers = DOMDriverLive
const Instrumented = Layer.provide(
  DevToolsLayer(DOMSink),
  Layer.mergeAll(DevToolsConfigDefault, DevToolsBusNoop),
)

// Compose: app.pipe(Effect.provide(Layer.provide(Drivers, Instrumented)))
```

For a live inspector, swap `DevToolsBusNoop` for `DevToolsBusLive`, set `DevToolsConfig.enableEvents` to `true`, and subscribe to `(yield* DevToolsBus).events`.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
