# effect-cycle

Cycle.js architecture rebuilt on [Effect](https://effect.website).

Your app is a pure function from **sources** (inputs) to **sinks** (outputs). All side effects live in **drivers** at the edges. Effect provides the dependency injection, lifecycle management, typed errors, and concurrency that the original Cycle.js approximated with RxJS streams.

## Packages

| Package | Description |
|---|---|
| `effect-cycle-core` | `App` type, `run`, `makeManagedRuntime`, `HotRuntime`, observability primitives |
| `effect-cycle-dom` | Renderer-agnostic DOM source: `DOMSource`, `DOMSourceLive`, event capture, isolation primitives |
| `effect-cycle-morphdom` | Morphdom renderer: `DOMSink`, `DOMDriverLive`, HTML-string diffing, `isolate` |
| `effect-cycle-tachys` | Tachys renderer: `DOMSink`, `DOMDriverLive`, vDOM rendering via `tachys/sync`, `isolate` |
| `effect-cycle-preact` | Preact renderer: `DOMSink`, `DOMDriverLive`, vDOM rendering via `preact`, `isolate` |
| `effect-cycle-react` | React renderer: `DOMSink`, `DOMDriverLive`, vDOM rendering via `react-dom/client`, `isolate` |
| `effect-cycle-lit-html` | lit-html renderer: `DOMSink`, `DOMDriverLive`, tagged-template rendering, `isolate` |
| `effect-cycle-vue` | Vue 3 renderer: `DOMSink`, `DOMDriverLive`, vDOM rendering via `vue`, `isolate` |
| `effect-cycle-solid` | Solid renderer: `ReactiveSink`, `ReactiveDriverLive`, signal-based fine-grained reactivity |
| `effect-cycle-http` | HTTP driver: adapter-based request routing, `@effect/platform` HttpClient, Schema validation |
| `effect-cycle-ws` | WebSocket driver: lifecycle-managed connections with `Layer.scoped` |
| `effect-cycle-router` | Router driver: hash or history-based routing with `RouterSource`/`RouterSink` |
| `effect-cycle-testing` | Test doubles for every driver: `TestDOMSource`, `TestHTTPSink`, etc. |
| `effect-cycle-devtools` | Observability layer: metrics, spans, and logging for all drivers |

`DOMSource` (event capture) is rendererless and lives in `effect-cycle-dom`. Pick **one** renderer per app:

- `effect-cycle-morphdom`, `effect-cycle-tachys`, `effect-cycle-preact`, `effect-cycle-react`, `effect-cycle-lit-html`, and `effect-cycle-vue` all expose the same VDOM-style `DOMSink` Tag (a stream of renderer-specific `VNode`s) and a `DOMDriverLive` that pairs with `DOMSourceLive`.
- `effect-cycle-solid` exposes a different contract, `ReactiveSink`, that mounts a component once and bridges Effect Streams to Solid signals via `fromStream(stream, initial) → Accessor`. Pushing whole trees through Solid would defeat its fine-grained reactivity, so it intentionally diverges from the VDOM sink shape.

## Quick Start

```typescript
import { Effect, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink } from "effect-cycle-morphdom"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink
  const count = yield* Ref.make(0)

  const inc$ = dom.select(".increment", "click").pipe(
    Stream.tap(() => Ref.update(count, (n) => n + 1)),
  )
  const dec$ = dom.select(".decrement", "click").pipe(
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
import { run } from "effect-cycle-core"
import { DOMConfigDefault } from "effect-cycle-dom"
import { DOMDriverLive } from "effect-cycle-morphdom"

run(app, DOMDriverLive.pipe(Layer.provide(DOMConfigDefault)))
```

## Testing

Swap live drivers for test doubles. No mocking libraries, no module patching:

```typescript
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Layer, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink } from "effect-cycle-morphdom"
import { TestDOMSource, TestDOMSink } from "effect-cycle-testing"

describe("counter", () => {
  it.effect("increments on click", () =>
    Effect.gen(function* () {
      // TestDOMSink is parameterized by the renderer's DOMSink Tag,
      // so it works with any VDOM-style renderer (morphdom, tachys, preact,
      // react, lit-html, vue).
      const { layer: sinkLayer, rendered } = yield* TestDOMSink(DOMSink)
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

Requests flow through a category-tagged adapter. Send requests on the sink side, read responses on the source side:

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

Lifecycle-managed WebSocket with `Layer.scoped`. The connection opens on scope entry and closes on scope exit:

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

## Router Driver

Hash-based or history-based routing with typed location streams:

```typescript
import { Effect, Stream } from "effect"
import { RouterSource, RouterSink } from "effect-cycle-router"

const app = Effect.gen(function* () {
  const router = yield* RouterSource
  const nav = yield* RouterSink

  // location$ emits { path, query, hash } on every navigation
  yield* Stream.runForEach(router.location$, (loc) =>
    Effect.log(`navigated to: ${loc.path}`),
  )

  // programmatic navigation
  yield* nav.push("/settings")
})
```

## Component Isolation

Each VDOM-style renderer (morphdom, tachys, preact, react, lit-html, vue) provides `isolate` to scope a component to a `[data-ns]` subtree:

```typescript
import { Effect } from "effect"
import { isolate } from "effect-cycle-morphdom"

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
import { Effect } from "effect"
import { makeHotRuntime } from "effect-cycle-core"

const runtime = Effect.runSync(makeHotRuntime(drivers))

Effect.runSync(runtime.run(app))

// On HMR update:
Effect.runSync(runtime.run(updatedApp)) // interrupts previous fiber, starts new one

// On shutdown:
Effect.runSync(runtime.dispose)
```

## DevTools

Wrap drivers with metrics and span instrumentation:

```typescript
import { Layer } from "effect"
import { DevToolsLayer, DevToolsConfigDefault } from "effect-cycle-devtools"
import { DOMSink } from "effect-cycle-morphdom"

// DevToolsLayer is parameterized by the renderer's DOMSink Tag so it can
// instrument any VDOM-style renderer (morphdom, tachys, preact, react,
// lit-html, vue) without coupling devtools to a specific one.
const instrumentedDrivers = Layer.provide(
  DevToolsLayer(DOMSink),
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

- **counter**: minimal DOM interaction (increment/decrement) using the tachys renderer, with Vite HMR
- **counter-preact**, **counter-react**, **counter-lit-html**, **counter-vue**: same counter through each VDOM-style renderer; useful as starter templates and to validate the renderer-agnostic source/sink split
- **counter-solid**: same counter through the signal-based `ReactiveSink`, demonstrating `fromStream(stream, initial) → Accessor` bridging
- **http-search**: debounced search with the HTTP driver
- **ws-chat**: WebSocket chat with lifecycle management
- **todomvc**: component isolation with `isolate`, `Ref`-based shared state, forked child components
- **realworld**: full [RealWorld](https://github.com/gothinkster/realworld) (Conduit) SPA with routing, auth, CRUD, pagination
- **realworld-api**: mock API server for the RealWorld example

Run any example:

```bash
cd examples/counter
pnpm dev
```

> The `realworld` example needs the mock API server running first:
> `cd examples/realworld-api && pnpm dev`, then in another terminal
> `cd examples/realworld && pnpm dev`.

## Architecture

See [DESIGN.md](DESIGN.md) for the full design document covering the Layer architecture, driver pattern, error handling, and testing approach.

## Development

### Prerequisites

- Node.js >= 22
- pnpm >= 9

### Setup

```bash
git clone <repo-url>
cd effect-cycle
pnpm install
```

### Commands

```bash
pnpm build       # Rollup + tsc for each package (dual ESM+CJS)
pnpm test        # Vitest across all packages
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # Biome lint + format check
pnpm lint:fix    # Auto-fix lint issues
```

### Project Structure

```
packages/
  core/       Core types, run, HMR, observability
  dom/        Renderer-agnostic DOM source (event capture, isolation primitives)
  morphdom/   Morphdom DOM sink (HTML-string diff renderer)
  tachys/     Tachys DOM sink (vDOM renderer via tachys/sync)
  preact/     Preact DOM sink (vDOM renderer)
  react/      React DOM sink (vDOM renderer via react-dom/client)
  lit-html/   lit-html DOM sink (tagged-template renderer)
  vue/        Vue 3 DOM sink (vDOM renderer)
  solid/      Solid ReactiveSink (signal-based fine-grained reactivity)
  http/       HTTP driver (adapter-based routing)
  ws/         WebSocket driver (managed lifecycle)
  router/     Router driver (hash/history routing)
  testing/    Test utilities and helpers
  devtools/   DevTools instrumentation

examples/
  counter/           Minimal counter (tachys)
  counter-preact/    Counter via Preact renderer
  counter-react/     Counter via React renderer
  counter-lit-html/  Counter via lit-html renderer
  counter-vue/       Counter via Vue 3 renderer
  counter-solid/     Counter via Solid ReactiveSink
  http-search/       HTTP search with debounce
  ws-chat/           WebSocket chat
  todomvc/           TodoMVC with isolation
  realworld/         Full Conduit SPA
  realworld-api/     Mock API server
```

### Tooling

- **Biome** for linting and formatting (not ESLint/Prettier)
- **Rollup + SWC** for bundling
- **tsc** for declaration files only (`emitDeclarationOnly`)
- **Vitest** with `@effect/vitest` for testing
- **Dual ESM + CJS** output for all packages

## License

MIT
