# effect-cycle

Cycle.js architecture rebuilt on [Effect](https://effect.website).

Your app is a pure function from **sources** (inputs) to **sinks** (outputs). All side effects live in **drivers** at the edges. Effect provides the dependency injection, lifecycle management, typed errors, and concurrency that the original Cycle.js approximated with RxJS streams.

## Packages

| Package | Description |
|---|---|
| `effect-cycle-core` | `App` type, `run`, `makeManagedRuntime`, `HotRuntime`, observability primitives |
| `effect-cycle-dom` | DOM driver — `DOMSource`, `DOMSink`, morphdom-based rendering, component isolation |
| `effect-cycle-http` | HTTP driver — PubSub-based request routing, `@effect/platform` HttpClient, Schema validation |
| `effect-cycle-ws` | WebSocket driver — lifecycle-managed connections with `Layer.scoped` |
| `effect-cycle-testing` | Test doubles for every driver — `TestDOMSource`, `TestHTTPSink`, etc. |
| `effect-cycle-devtools` | Observability layer — metrics, spans, and logging for all drivers |

## Quick Start

```typescript
import { Effect, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  const count = yield* Ref.make(0)

  const inc$ = dom.select(".increment").pipe(
    Stream.tap(() => Ref.update(count, (n) => n + 1)),
  )
  const dec$ = dom.select(".decrement").pipe(
    Stream.tap(() => Ref.update(count, (n) => n - 1)),
  )

  const vdom$ = Stream.mergeAll([inc$, dec$], { concurrency: "unbounded" }).pipe(
    Stream.mapEffect(() => Ref.get(count)),
    Stream.map(
      (n) => `<div>
        <h1>Count: ${n}</h1>
        <button class="decrement">-</button>
        <button class="increment">+</button>
      </div>`,
    ),
  )

  yield* sink.render(vdom$)
})
```

Run it:

```typescript
import { Layer } from "effect"
import { DOMConfigDefault, DOMDriverLive } from "effect-cycle-dom"
import { run } from "effect-cycle-core"

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

## Testing

Swap live drivers for test doubles — no mocking libraries, no module patching:

```typescript
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { TestDOMSource, TestDOMSink } from "effect-cycle-testing"

describe("counter", () => {
  it.effect("increments on click", () =>
    Effect.gen(function* () {
      const { layer: sinkLayer, rendered } = TestDOMSink()
      const sourceLayer = TestDOMSource({
        ".increment": [new Event("click")],
      })

      // run your app against test layers
      yield* app.pipe(
        Effect.provide(Layer.merge(sourceLayer, sinkLayer)),
      )

      expect(rendered.length).toBeGreaterThan(0)
    }),
  )
})
```

## HTTP Driver

Requests flow through a category-tagged PubSub. Send requests on the sink side, read responses on the source side:

```typescript
import { Effect, Stream } from "effect"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { HTTPSink, HTTPSource } from "effect-cycle-http"

const app = Effect.gen(function* () {
  const source = yield* HTTPSource
  const sink = yield* HTTPSink

  const req$ = Stream.make(HttpClientRequest.get("/api/users"))
  yield* sink.request("users", req$)

  const users$ = source.response("users")
  // process users$...
})
```

Schema validation at the boundary:

```typescript
import { Schema } from "effect"
import { validatedResponseEffect } from "effect-cycle-http"

const User = Schema.Struct({ id: Schema.Number, name: Schema.String })

const app = Effect.gen(function* () {
  // yields HTTPSource from context, decodes each response through the schema
  const users$ = yield* validatedResponseEffect("users", User)
  // users$ is Stream<{ id: number, name: string }, HTTPError | ResponseError | ParseError>
})
```

## WebSocket Driver

Lifecycle-managed WebSocket with `Layer.scoped` — the connection opens on scope entry and closes on scope exit:

```typescript
import { Effect, Stream } from "effect"
import { WSSource, WSSink } from "effect-cycle-ws"

const app = Effect.gen(function* () {
  const source = yield* WSSource
  const sink = yield* WSSink

  yield* source.connected
  yield* sink.send(Stream.make("hello"))

  yield* Stream.runForEach(source.messages, (msg) =>
    Effect.log(`received: ${msg.data}`),
  )
})
```

## Component Isolation

The DOM driver provides `isolate` to scope a component to a `[data-ns]` subtree:

```typescript
import { Effect } from "effect"
import { isolate } from "effect-cycle-dom"

const TodoItem = (todo: Todo) => Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  // this component only sees events from within its [data-ns] container
  // ...
})

// In the parent:
yield* isolate(TodoItem(todo), `todo-${todo.id}`).pipe(Effect.fork)
```

## Hot Module Replacement

`HotRuntime` manages a single running fiber that can be interrupted and restarted with new app code while keeping driver layers alive:

```typescript
import { makeHotRuntime } from "effect-cycle-core"

const hot = makeHotRuntime(drivers)
await hot.run(app)

// On HMR update:
await hot.run(updatedApp) // interrupts previous fiber, starts new one

// On shutdown:
await hot.dispose()
```

## DevTools

Wrap drivers with metrics and span instrumentation:

```typescript
import { Layer } from "effect"
import { DevToolsLayer, DevToolsConfigDefault } from "effect-cycle-devtools"

const instrumentedDrivers = Layer.provide(
  DevToolsLayer,
  Layer.mergeAll(DOMDriverLive, HTTPDriverLive, DevToolsConfigDefault),
)
```

## Config

HTTP and WebSocket drivers can read configuration from environment variables:

```typescript
import { HTTPDriverConfigured } from "effect-cycle-http"
import { WSConfigFromEnv } from "effect-cycle-ws"
```

| Variable | Driver | Default |
|---|---|---|
| `HTTP_BASE_URL` | HTTP | `""` (no prefix) |
| `HTTP_TIMEOUT_MS` | HTTP | `30000` |
| `HTTP_RETRIES` | HTTP | `0` |
| `WS_URL` | WebSocket | (required) |
| `WS_PROTOCOLS` | WebSocket | (optional, comma-separated) |

## Examples

Working examples live in `examples/`:

- **counter** — minimal DOM interaction (increment/decrement)
- **http-search** — debounced search with the HTTP driver
- **ws-chat** — WebSocket chat with lifecycle management
- **todomvc** — component isolation with `isolate`, `Ref`-based shared state, forked child components

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed walkthrough of the Layer architecture, driver pattern, error handling, and testing approach.

See [EFFECT_CYCLE.md](EFFECT_CYCLE.md) for the original design document.

## Development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit across all packages
pnpm test         # vitest across all packages
pnpm build        # rollup + tsc for each package (dual ESM+CJS)
pnpm lint         # biome check
pnpm lint:fix     # biome check --write
```

## License

MIT
