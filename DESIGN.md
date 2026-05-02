# Effect-Cycle: A Modern Reimagining of Cycle.js with Effect

> **RFC / Design Document**
> TypeScript 5.x · Effect 3.x · Zero runtime dependencies beyond Effect

---

## The Core Idea

Cycle.js had a brilliant insight: your application is a **pure function** from inputs (sources) to outputs (sinks), with all side effects pushed to "drivers" at the edges. This is the "functional core, imperative shell" pattern taken to its logical extreme.

The problem was never the architecture; it was the implementation. Cycle tried to build a dependency injection system, a lifecycle manager, an error recovery system, and a concurrency model out of nothing but RxJS streams and ad-hoc wiring. Effect already *is* all of those things.

Effect-Cycle isn't a framework. It's a **pattern** for applying Cycle's architecture using Effect's existing primitives.

---

## What Went Wrong with Cycle.js

### 1. The Circular Type Problem

Cycle's signature looks simple:

```typescript
function main(sources: Sources): Sinks
```

But `Sources` is determined by the drivers, and the drivers consume `Sinks`, which is the return type of `main`, which takes `Sources` as input. This circular dependency was essentially unsolvable in TypeScript. The community tried mapped types, conditional types, declaration merging. Nothing worked cleanly. Most apps ended up with `any` somewhere in the chain.

### 2. Stream Library Lock-in

Cycle was married to xstream (and before that, RxJS). The `@cycle/run` package had an `adapt()` mechanism to bridge stream libraries, but it was a band-aid. You couldn't use a different concurrency model or swap in a pull-based stream without rewriting your drivers.

### 3. Drivers Were Just Functions

A Cycle driver is `(sink$: Stream<Request>) => Stream<Response>`. That's it. No lifecycle hooks, no resource acquisition/release, no dependency injection between drivers, no error typing. Opening a WebSocket connection? You tracked it manually. Driver that depends on another driver? Good luck wiring that.

### 4. String-Based Isolation

Component isolation used `isolate(Component, scope)` where `scope` was a string:

```typescript
isolate(TodoItem, '.item-3')  // typo here? silent failure at runtime
```

No static verification. No guarantees about resource cleanup when a component unmounts. The scoping mechanism was bolted onto the DOM driver specifically and didn't generalize well to other drivers.

### 5. Error Handling Was an Afterthought

A stream error would propagate up and often kill the entire application. There was no typed error channel, so you'd use `.catch()` and hope for the best. One bad HTTP response parsing could take down your DOM rendering.

### 6. Testing Required Stream Mocking

Testing a Cycle component meant manually constructing fake source streams, subscribing to sink streams, and asserting on emitted values. It was verbose and fragile.

---

## How Effect Solves Each Problem

| Concern | Cycle.js | Effect-Cycle |
|---|---|---|
| App signature | `main(sources) → sinks` (untyped circular) | `Effect.gen` with services in the `R` channel (inferred, acyclic) |
| Driver | Bare function: `sink$ → source$` | `Layer` with lifecycle, DI, and composition |
| Error handling | Stream `.catch()`, often kills the app | Typed `E` channel with `catchTags`, retry, fallback |
| Isolation | `isolate(C, 'string-scope')` | `Scope` + namespaced `Layer` (type-safe) |
| Testing | Mock streams, manual wiring | Swap `Layer.succeed(TestImpl)`, no mocking library |
| Resource cleanup | Manual `dispose()` | `Scope.addFinalizer` (guaranteed, deterministic) |
| Concurrency | Depends on Rx scheduler | Fiber-based structured concurrency |
| Stream library | xstream/RxJS (locked in) | `Effect.Stream` (or adapt anything) |

---

## Architecture Overview

The system is organized into four layers. Each layer only knows about the one directly above it, via `Context.Tag`:

```
┌─────────────────────────────────────────────────┐
│  App (Pure)                                     │
│  Effect.gen → reads Sources, writes to Sinks    │
├─────────────────────────────────────────────────┤
│  Services (Tags)                                │
│  DOMSource, HTTPSource, WSSource, etc.          │
├─────────────────────────────────────────────────┤
│  Layers (Drivers)                               │
│  Lifecycle, resource management, composition    │
├─────────────────────────────────────────────────┤
│  Runtime                                        │
│  ManagedRuntime.make → runFork                  │
└─────────────────────────────────────────────────┘
```

---

## 1. The Core Type: App as a Pure Function, Now With Real Types

### The Problem

Cycle.js typed `main` as essentially `(sources: any) => any`. Circular inference between sources and sinks was unsolvable in TypeScript's type system.

### The Solution

Effect's service pattern (`Context.Tag`) lets us declare source/sink contracts as tagged services. The app function returns an `Effect` that declares its requirements in the `R` channel, with no circular types needed.

```typescript
import { Effect, Context, Stream, Layer } from "effect"

// ── Services are declared, not inferred ──
// Each driver exposes a Source service (read) and consumes Sinks (write)

class DOMSource extends Context.Tag("DOMSource")<
  DOMSource,
  {
    readonly select: (sel: string) => Stream.Stream<Event, never, never>
    readonly element: Stream.Stream<Element, never, never>
  }
>() {}

class DOMSink extends Context.Tag("DOMSink")<
  DOMSink,
  {
    readonly render: (vdom: Stream.Stream<VNode>) => Effect.Effect<void>
  }
>() {}

class HTTPSource extends Context.Tag("HTTPSource")<
  HTTPSource,
  {
    readonly response: (category: string) =>
      Stream.Stream<Response, HTTPError, never>
  }
>() {}

class HTTPSink extends Context.Tag("HTTPSink")<
  HTTPSink,
  {
    readonly request: (req$: Stream.Stream<Request>) => Effect.Effect<void>
  }
>() {}
```

Now the app itself is just an `Effect.gen`:

```typescript
const app = Effect.gen(function* () {
  const dom    = yield* DOMSource
  const http   = yield* HTTPSource
  const domSk  = yield* DOMSink
  const httpSk = yield* HTTPSink

  const click$ = dom.select(".btn").pipe(
    Stream.map(() => new Request("/api/data"))
  )

  yield* httpSk.request(click$)

  const response$ = http.response("data").pipe(
    Stream.map(renderView)
  )

  yield* domSk.render(response$)
})
```

The inferred type of `app` is:

```typescript
Effect.Effect<void, HTTPError, DOMSource | DOMSink | HTTPSource | HTTPSink>
//            ^success ^error    ^requirements (all inferred automatically)
```

No circular inference. No generics gymnastics. The `R` channel accumulates requirements as you `yield*` services, and TypeScript tracks it all.

### Why This Is Better

In Cycle.js, you'd write `function main(sources: { DOM: DOMSource, HTTP: HTTPSource })` and manually keep the return type `{ DOM: Stream<VNode>, HTTP: Stream<Request> }` in sync. Add a new driver and you update both. Forget one and you get a runtime error.

Here, if you `yield* SomeNewSource` in your app, TypeScript immediately knows `SomeNewSource` must be provided. If you forget to include its Layer, you get a compile error. The wiring is verified statically.

---

## 2. Drivers = Layers

### The Problem

Cycle drivers were bare functions with no lifecycle management. Opening a WebSocket? You manually tracked it. Need a driver that depends on another driver (e.g., an authenticated HTTP driver that needs a token from a Storage driver)? There was no mechanism for that.

### The Solution

Effect `Layer`s are constructors with acquire/release semantics, typed dependencies, and automatic composition. A driver is a `Layer` that provides source services and consumes sink streams.

```typescript
import { Layer, Effect, Stream, Queue, Scope } from "effect"

const DOMDriverLive = Layer.scoped(DOMSource,
  Effect.gen(function* () {
    const root = document.getElementById("app")!

    // Lifecycle: guaranteed cleanup when scope closes
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => { root.innerHTML = "" })
    )

    return {
      select: (sel: string) =>
        Stream.async<Event>((emit) => {
          const el = root.querySelector(sel)
          const handler = (e: Event) => emit.single(e)
          el?.addEventListener("click", handler)
          // Cleanup returned here runs when the stream consumer ends
          return Effect.sync(() =>
            el?.removeEventListener("click", handler)
          )
        }),
      element: Stream.make(root),
    }
  })
)

const HTTPDriverLive = Layer.scoped(HTTPSource,
  Effect.gen(function* () {
    const pending = yield* Queue.unbounded<Request>()

    yield* Effect.addFinalizer(() => Queue.shutdown(pending))

    return {
      response: (category: string) =>
        Stream.fromQueue(pending).pipe(
          Stream.filter((r) => r.url.includes(category)),
          Stream.mapEffect((req) =>
            Effect.tryPromise({
              try: () => fetch(req),
              catch: (e) => new HTTPError({ cause: e }),
            })
          )
        ),
    }
  })
)
```

### Driver Composition

Drivers that depend on other drivers just declare it:

```typescript
// WebSocket driver that needs auth tokens from the Auth service
const WSDriverLive = Layer.scoped(WSSource,
  Effect.gen(function* () {
    const auth = yield* AuthService  // dependency!
    const token = yield* auth.getToken()

    const ws = new WebSocket(`wss://api.example.com?token=${token}`)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => ws.close())
    )

    return {
      messages: Stream.async<MessageEvent>((emit) => {
        ws.onmessage = (e) => emit.single(e)
        return Effect.sync(() => { ws.onmessage = null })
      }),
    }
  })
)
```

Now compose all drivers. Order and dependencies resolved automatically:

```typescript
const DriversLive = Layer.mergeAll(
  DOMDriverLive,
  HTTPDriverLive,
  WSDriverLive,
).pipe(
  Layer.provide(AuthServiceLive)  // WSDriverLive needs this
)

// Run the app
const main = app.pipe(
  Effect.provide(DriversLive)
  // Compile error if any requirement is missing
)
```

Layer handles the dependency DAG. If `WSDriverLive` requires `AuthService`, and `AuthServiceLive` requires `StorageService`, Effect resolves the entire chain. You never manually order initialization.

---

## 3. Typed Error Handling

### The Problem

In Cycle.js, a stream error would propagate and often kill the entire application. There was no typed error channel, so you'd `.catch()` and hope for the best. One bad JSON parse in an HTTP response stream could take down DOM rendering.

### The Solution

Effect and Stream carry errors in the `E` channel. You can pattern-match on error tags, recover per-stream, and guarantee the app survives individual failures.

```typescript
import { Effect, Stream, Data, Schedule } from "effect"

// ── Errors as tagged union types ──
class HTTPError extends Data.TaggedError("HTTPError")<{
  readonly status: number
  readonly body: string
}> {}

class ParseError extends Data.TaggedError("ParseError")<{
  readonly input: unknown
  readonly message: string
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly url: string
  readonly ms: number
}> {}
```

Per-request recovery with retry and timeout:

```typescript
const resilientFetch = (url: string) =>
  Effect.tryPromise({
    try: () => fetch(url),
    catch: () => new HTTPError({ status: 0, body: "Network failure" }),
  }).pipe(
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.compose(Schedule.recurs(3))
      )
    ),
    Effect.timeoutFail({
      duration: "5 seconds",
      onTimeout: () => new TimeoutError({ url, ms: 5000 }),
    })
  )
```

Exhaustive error handling. The compiler tells you what you missed:

```typescript
const handled = resilientFetch("/api/data").pipe(
  Effect.catchTags({
    HTTPError: (e) =>
      Effect.succeed(errorView(`HTTP ${e.status}: ${e.body}`)),
    TimeoutError: (e) =>
      Effect.succeed(errorView(`Timeout after ${e.ms}ms`)),
  })
)
// If ParseError appears in the channel and you don't handle it,
// TypeScript flags it. No silent swallowing.
```

Stream-level recovery. One bad event doesn't kill the stream:

```typescript
const safeStream = http.response("users").pipe(
  Stream.mapEffect((r) =>
    Effect.tryPromise({
      try: () => r.json(),
      catch: (e) => new ParseError({ input: r, message: String(e) }),
    })
  ),
  // Bad JSON is skipped, stream continues
  Stream.catchTag("ParseError", (e) =>
    Stream.make(fallbackData(e.message))
  )
)
```

---

## 4. Component Isolation

### The Problem

Cycle's `isolate()` used magic string scopes:

```typescript
isolate(TodoItem, '.item-3')  // typo? silent failure at runtime
```

No static verification. No guarantees about resource cleanup when a component unmounts. Scoping was DOM-driver-specific and didn't generalize.

### The Solution

Effect's `Scope` and `Layer` give us real isolation. Each component gets its own scoped layer with namespaced services.

```typescript
import { Effect, Layer, Scope } from "effect"

// A component is an Effect that requires sources and produces sinks
type Component<R, E = never> = Effect.Effect<void, E, R>

const isolate = <R, E>(
  component: Component<R, E>,
  namespace: string
) =>
  Effect.gen(function* () {
    const parentDOM = yield* DOMSource

    // Namespaced DOM source, scoped to this component's subtree
    const namespacedDOM = Layer.succeed(DOMSource, {
      select: (sel) =>
        parentDOM.select(`[data-ns="${namespace}"] ${sel}`),
      element:
        parentDOM.select(`[data-ns="${namespace}"]`).pipe(
          Stream.take(1)
        ),
    })

    // Run the component in its own scope
    // Resources are cleaned up when this scope closes
    yield* component.pipe(
      Effect.provide(namespacedDOM),
      Effect.scoped
    )
  })
```

Usage with a list of isolated components:

```typescript
const TodoList = Effect.gen(function* () {
  const dom = yield* DOMSource

  const todos$ = dom.select(".todos").pipe(
    Stream.flatMap((items) =>
      Stream.mergeAll(
        items.map((item) =>
          Stream.fromEffect(
            isolate(TodoItem, `todo-${item.id}`)
          )
        ),
        { concurrency: "unbounded" }
      )
    )
  )
})
```

The namespace is still a string for DOM purposes, but the `Layer`/`Scope` guarantees resource cleanup, and the `R` channel guarantees type safety. You can't accidentally use an un-provided service inside an isolated component.

---

## 5. Testing Without Mocks

### The Problem

Testing a Cycle.js component required creating fake stream sources, manually subscribing to sink streams, and asserting on emitted values. Lots of boilerplate, easy to get wrong, and you often needed a mock library.

### The Solution

Effect's `Layer` system means testing is just providing a different `Layer`. Create a `TestDOMSource` that emits scripted events. No mock library needed.

```typescript
import { Effect, Layer, Stream, TestClock, Fiber } from "effect"
import { expect, test } from "vitest"

// ── Test implementation: scripted DOM events ──
const TestDOMDriver = (events: Record<string, Event[]>) =>
  Layer.succeed(DOMSource, {
    select: (sel: string) =>
      Stream.fromIterable(events[sel] ?? []),
    element: Stream.make(document.createElement("div")),
  })

// ── Test implementation: capture HTTP requests ──
const TestHTTPDriver = () => {
  const captured: Request[] = []

  const layer = Layer.succeed(HTTPSink, {
    request: (req$) =>
      Stream.runForEach(req$, (r) =>
        Effect.sync(() => { captured.push(r) })
      ),
  })

  return { layer, captured } as const
}
```

The test itself:

```typescript
test("clicking button sends HTTP request", async () => {
  const click = new MouseEvent("click")
  const domLayer = TestDOMDriver({ ".btn": [click, click, click] })
  const { layer: httpLayer, captured } = TestHTTPDriver()

  await Effect.runPromise(
    app.pipe(
      Effect.provide(Layer.mergeAll(domLayer, httpLayer))
    )
  )

  expect(captured).toHaveLength(3)
  expect(captured[0].url).toBe("/api/data")
})
```

Time-travel testing with `TestClock`:

```typescript
test("debounces rapid clicks", () =>
  Effect.gen(function* () {
    const fiber = yield* app.pipe(Effect.fork)

    yield* TestClock.adjust("300 millis")
    // assert intermediate state...

    yield* TestClock.adjust("2 seconds")
    // assert final state...

    yield* Fiber.interrupt(fiber)
  }).pipe(
    Effect.provide(TestLayers),
    Effect.runPromise
  )
)
```

No fake timers. No `jest.useFakeTimers()`. The `TestClock` is a Layer that you provide, and `adjust` advances it deterministically.

---

## 6. The Runtime

### The Problem

Cycle's `run()` was a complex function that wired sources to sinks with circular proxy subjects, subscription management, and disposal logic. Hard to debug, hard to customize.

### The Solution

With Effect, "run" is just providing layers and executing. The Effect runtime handles scheduling, interruption, and finalization.

```typescript
import { Effect, Layer, ManagedRuntime, Fiber, Logger } from "effect"

// The entire "framework" runtime
const run = <E>(
  app: Effect.Effect<void, E, Drivers>,
  drivers: Layer.Layer<Drivers>
) =>
  app.pipe(
    Effect.provide(drivers),
    Effect.tapErrorCause(Effect.logError),
    Effect.runFork
  )
```

For long-lived apps with hot reload support:

```typescript
const DevRuntime = ManagedRuntime.make(
  DriversLive.pipe(
    Layer.provide(Logger.pretty),
    Layer.provide(DevToolsLayer),
  )
)

// Start the app
const fiber = await DevRuntime.runFork(app)

// Hot reload: interrupt and restart cleanly
await Fiber.interrupt(fiber)
const newFiber = await DevRuntime.runFork(updatedApp)

// Full shutdown, all resources released
await ManagedRuntime.dispose(DevRuntime)
```

No proxy subjects. No circular subscriptions. No reimplementation of half an Rx scheduler. Effect's runtime does all of that correctly and efficiently.

---

## 7. Bonus: What Else This Enables

### Structured Concurrency

Fibers mean you can fork background tasks (polling, WebSocket heartbeats) and they get automatically interrupted when the parent scope closes. No leaked subscriptions, ever.

```typescript
const app = Effect.gen(function* () {
  // Fork a background heartbeat that dies when the app dies
  yield* Stream.tick("30 seconds").pipe(
    Stream.tap(() => sendHeartbeat),
    Stream.runDrain,
    Effect.fork  // runs in background, tied to this scope
  )

  // ... rest of app
})
```

### Observability via Spans and Metrics

Because everything is an Effect, you get tracing and metrics for free:

```typescript
const fetchUser = (id: string) =>
  resilientFetch(`/api/users/${id}`).pipe(
    Effect.withSpan("fetchUser", { attributes: { userId: id } })
  )
```

### Schema Validation at Boundaries

Effect Schema can validate data at driver boundaries:

```typescript
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^.+@.+$/)),
})

const users$ = http.response("users").pipe(
  Stream.mapEffect(
    Schema.decodeUnknown(Schema.Array(User))
  )
)
// Stream<User[], ParseError, never>
// Invalid data becomes a typed ParseError, not a runtime crash
```

### Config and Feature Flags

Effect's `Config` system lets drivers read configuration from environment, files, or remote sources, with typed fallbacks:

```typescript
const APIBaseURL = Config.string("API_BASE_URL").pipe(
  Config.withDefault("https://api.example.com")
)

const HTTPDriverLive = Layer.scoped(HTTPSource,
  Effect.gen(function* () {
    const baseURL = yield* APIBaseURL
    // ...
  })
)
```

---

## Summary

Effect-Cycle keeps the brilliant core insight of Cycle.js (your app is a pure function, side effects live at the edges) but replaces the ad-hoc machinery with Effect's battle-tested primitives:

- **`Context.Tag`** replaces circular type inference
- **`Layer`** replaces hand-rolled driver lifecycle
- **`Scope`** replaces string-based isolation
- **Typed errors** replace silent stream death
- **`TestClock` + Layer swapping** replace mock-heavy testing
- **`ManagedRuntime`** replaces the complex `run()` wiring

The result is the same architecture, but with types that actually work, errors you can reason about, testing that's trivial, and an ecosystem (Schema, Config, Metrics, Tracing) that comes along for free.