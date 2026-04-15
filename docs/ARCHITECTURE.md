# Architecture

This document describes the architecture of effect-cycle: how drivers work, how layers compose, how errors flow, and how testing is achieved through pure dependency injection.

## The Core Pattern

An effect-cycle app is a pure `Effect` that reads services (sources) and writes to services (sinks):

```
App = Effect<void, E, DOMSource | DOMSink | HTTPSource | HTTPSink | ...>
```

The `R` type parameter accumulates all required services automatically. The app never constructs a driver — it only yields service tags from context. Drivers are provided externally via `Layer` at the application boundary.

```
┌─────────────────────────────────┐
│          Your App (pure)        │
│                                 │
│   DOMSource ──► state ──► DOMSink
│                                 │
│   HTTPSource ──► data ──► HTTPSink
│                                 │
└─────────────────────────────────┘
         ▲                ▲
         │   Layer.merge  │
    ┌────┴────┐     ┌─────┴────┐
    │DOMDriver│     │HTTPDriver│
    │  Live   │     │   Live   │
    └─────────┘     └──────────┘
```

This is the same architecture as Cycle.js, but implemented with Effect's `Context.Tag` + `Layer` instead of ad-hoc dependency injection.

## Services and Tags

Every driver exposes two services — a **source** (reads from the outside world) and a **sink** (writes to the outside world):

| Driver | Source | Sink |
|--------|--------|------|
| DOM | `DOMSource` — `select(selector)` returns `Stream<Event>` | `DOMSink` — `render(vdom$)` writes HTML to the DOM |
| HTTP | `HTTPSource` — `response(category)` returns `Stream<HttpClientResponse>` | `HTTPSink` — `request(category, req$)` sends HTTP requests |
| WebSocket | `WSSource` — `messages` stream + `connected` effect | `WSSink` — `send(msg$)` pushes messages to the socket |

Services are defined using the `class extends Context.Tag(...)` pattern:

```typescript
class DOMSource extends Context.Tag("effect-cycle/DOMSource")<
  DOMSource,
  {
    readonly select: (selector: string) => Stream.Stream<Event>
    readonly element: Effect.Effect<Element, DOMError>
  }
>() {}
```

All tag identifiers use the `"effect-cycle/"` prefix.

## Layer Architecture

Drivers are implemented as `Layer`s — specifically `Layer.scopedContext` or `Layer.scoped` — which ties their lifecycle to Effect's `Scope`. Resources are acquired on layer construction and released via `Effect.addFinalizer`.

### DOM Driver

`DOMDriverLive: Layer<DOMSource | DOMSink, DOMError, DOMConfig>`

- Requires `DOMConfig` (defaults to `{ rootSelector: "#app" }`)
- Queries `document.querySelector(rootSelector)` during construction — fails with `DOMError` if not found
- `select(selector)` bridges `addEventListener`/`removeEventListener` into a `Stream` via `Stream.async`
- `render(vdom$)` forks a fiber that drains the stream, using [morphdom](https://github.com/patrick-steele-idem/morphdom) for efficient DOM patching
- Finalizer clears `root.innerHTML`

### HTTP Driver

`HTTPDriverLive: Layer<HTTPSource | HTTPSink, never, HttpClient.HttpClient>`

- Requires `@effect/platform`'s `HttpClient.HttpClient` service
- Internal routing uses an `PubSub<{ category, response }>`:
  1. `sink.request(category, req$)` forks a fiber that drains requests, executes each via `HttpClient`, and publishes `{ category, response }` to the PubSub
  2. `source.response(category)` subscribes to the PubSub and filters by category
- This PubSub pattern mirrors Cycle.js's category-based request/response routing
- Finalizer shuts down the PubSub

### WebSocket Driver

`WSDriverLive: Layer<WSSource | WSSink, never, WSConfig>`

- Creates a `WebSocket` in the acquire phase
- `connected` resolves via `Effect.async` on `ws.onopen`
- `messages` bridges `ws.onmessage` into a `Stream` via `Stream.async`
- `send(msg$)` forks a fiber that drains the stream and calls `ws.send()`
- Finalizer calls `ws.close()`

## Running an App

Two entry points in `effect-cycle-core`:

### `run(app, drivers)`

One-shot execution. Provides layers and forks:

```typescript
export const run = <E, R>(
  app: App<void, E, R>,
  drivers: Layer.Layer<R>,
): Fiber.RuntimeFiber<void, E> =>
  app.pipe(
    Effect.provide(drivers),
    Effect.tapErrorCause(Effect.logError),
    Effect.runFork,
  )
```

### `makeManagedRuntime(drivers)`

Creates a `ManagedRuntime` for long-lived apps where you need more control over the lifecycle:

```typescript
const runtime = makeManagedRuntime(drivers)
const fiber = runtime.runFork(app)
```

### `makeHotRuntime(drivers)`

For HMR scenarios. Manages a single fiber that can be interrupted and restarted while keeping driver layers alive:

```typescript
const hot = makeHotRuntime(drivers)
await hot.run(app)          // first run
await hot.run(updatedApp)   // interrupts previous, starts new
await hot.dispose()         // full shutdown
```

The key insight: drivers are expensive to create (DOM listeners, WebSocket connections, HTTP clients) but cheap to reuse. `HotRuntime` initializes drivers once and only restarts the app fiber on code changes.

## Component Isolation

The DOM driver provides `isolate(component, namespace)` to scope a component to a `[data-ns="${namespace}"]` subtree:

```typescript
export const isolate = <A, E, R>(
  component: Effect.Effect<A, E, R>,
  namespace: string,
): Effect.Effect<A, E | DOMError, Exclude<R, DOMSource | DOMSink> | DOMSource | DOMSink>
```

Isolation works by:
1. Reading the parent `DOMSource` and `DOMSink` from context
2. Finding the `[data-ns="${namespace}"]` element within the parent root
3. Creating a new `DOMSource` scoped to that element (selectors only match within the namespace)
4. Creating a new `DOMSink` that delegates rendering to the parent sink
5. Providing these namespaced services to the child component

This is **per-driver isolation** (not a generic core-level concept), which keeps the API simple and driver-specific.

## Error Handling

Each driver defines a tagged error type:

| Error | Tag | Fields |
|-------|-----|--------|
| `DOMError` | `"DOMError"` | `selector`, `message` |
| `HTTPError` | `"HTTPError"` | `status`, `body`, `url` |
| `WSError` | `"WSError"` | `url`, `code?`, `reason?` |
| `DriverInitError` | `"DriverInitError"` | `driver`, `cause` |

Errors use `Data.TaggedError`, making them catchable with `Effect.catchTag`:

```typescript
app.pipe(
  Effect.catchTag("DOMError", (err) =>
    Effect.log(`DOM error at ${err.selector}: ${err.message}`),
  ),
)
```

The `DOMDriverLive` layer has `DOMError` in its error channel (root element not found is a real possibility). Examples use `Layer.orDie` to convert this to a defect since a missing root is a fatal configuration error.

## Schema Validation

`effect-cycle-http` provides `validatedResponse` and `validatedResponseEffect` to decode HTTP response bodies through Effect `Schema` at the boundary:

```typescript
const users$ = validatedResponse(source, "users", UserSchema)
// Stream<User, HTTPError | ResponseError | ParseError>
```

Parse failures appear as typed `ParseError` in the stream's error channel — no `unknown` to deal with downstream.

## Config Integration

Drivers can read configuration from environment variables via `Effect.Config`:

- `HTTPDriverConfigured` reads `HTTP_BASE_URL`, `HTTP_TIMEOUT_MS`, `HTTP_RETRIES` and applies them to the `HttpClient`
- `WSConfigFromEnv` reads `WS_URL` (required) and `WS_PROTOCOLS` (optional)

Config layers compose like any other layer — they can be overridden in tests by providing explicit values.

## Observability

### Metrics

`effect-cycle-core` exports pre-built `Metric.counter` instances:

| Metric | Description |
|--------|-------------|
| `effect_cycle.http.requests.total` | HTTP requests sent |
| `effect_cycle.http.errors.total` | HTTP errors |
| `effect_cycle.ws.messages.received` | WebSocket messages received |
| `effect_cycle.ws.messages.sent` | WebSocket messages sent |
| `effect_cycle.dom.events.total` | DOM events captured |
| `effect_cycle.dom.renders.total` | DOM renders |

### instrumentService

A generic `Layer` wrapper that patches service methods without modifying the original implementation:

```typescript
const instrumented = instrumentService(DOMSource, {
  select: (original) => (selector) =>
    original(selector).pipe(
      Stream.tap(() => Metric.increment(domEventCount)),
    ),
})
```

### DevTools Package

`effect-cycle-devtools` provides pre-configured instrumentation layers:

- `instrumentDOMSource` / `instrumentDOMSink` / `instrumentDOM` — metrics and logging for DOM operations
- `instrumentHTTP` — metrics and logging for HTTP requests
- `instrumentWS` — metrics and logging for WebSocket messages
- `DevToolsLayer` — merges all of the above

All controlled by `DevToolsConfig` with `logLevel`, `enableMetrics`, and `enableSpans` flags.

## Testing

Testing is purely compositional — swap `Layer`s, no mocking framework:

### Test Factories

Each driver has source and sink test factories in `effect-cycle-testing`:

| Factory | Signature |
|---------|-----------|
| `TestDOMSource` | `(events: Record<string, Event[]>) => Layer<DOMSource>` |
| `TestDOMSink` | `() => { layer: Layer<DOMSink>, rendered: VNode[] }` |
| `TestHTTPSource` | `(responses: Record<string, HttpClientResponse[]>) => Layer<HTTPSource>` |
| `TestHTTPSink` | `() => { layer: Layer<HTTPSink>, captured: { category, request }[] }` |
| `TestWSSource` | `(messages: MessageEvent[]) => Layer<WSSource>` |
| `TestWSSink` | `() => { layer: Layer<WSSink>, sent: (string \| ArrayBuffer)[] }` |

Source factories take scripted data and replay it. Sink factories capture what the app writes for assertion.

### Test Pattern

```typescript
it.effect("my feature works", () =>
  Effect.gen(function* () {
    const { layer: sinkLayer, rendered } = TestDOMSink()
    const sourceLayer = TestDOMSource({ ".btn": [new Event("click")] })

    yield* myApp.pipe(Effect.provide(Layer.merge(sourceLayer, sinkLayer)))

    expect(rendered).toEqual(["<div>clicked</div>"])
  }),
)
```

Tests use `@effect/vitest` with `it.effect` for running `Effect`s directly in test cases. No `Effect.runPromise` boilerplate.

## Package Dependency Graph

```
effect-cycle-core (no internal deps)
  ├── effect-cycle-dom (peers: core)
  ├── effect-cycle-http (peers: core, @effect/platform)
  ├── effect-cycle-ws (peers: core)
  ├── effect-cycle-testing (peers: core, dom, http, ws)
  └── effect-cycle-devtools (peers: core, dom, http, ws)
```

All packages produce dual ESM + CJS output via Rollup + SWC, with TypeScript declarations generated by `tsc --emitDeclarationOnly`.
