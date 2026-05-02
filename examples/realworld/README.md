# RealWorld (Conduit)

A full single-page application implementing the [RealWorld spec](https://github.com/gothinkster/realworld), also known as Conduit. This is the largest effect-cycle example: it combines hash-based routing via `RouterSource`/`RouterSink`, authenticated HTTP calls to the RealWorld API, a `Queue`-based action bus, and multi-ref state management, all rendered by a single stream-driven render loop. Requires the `realworld-api` server running in a separate terminal.

## Getting started

In one terminal, start the API server:

```sh
cd ../realworld-api
pnpm start
```

In another terminal, start the frontend dev server:

```sh
pnpm dev
```

The frontend starts at `http://localhost:5173` and proxies API calls to `http://localhost:4100`.

## What it demonstrates

- `RouterSource` for reacting to URL/hash changes as a stream
- `RouterSink` for programmatic navigation
- `matchPath` for parsing route parameters from the current path
- Multi-driver layer composition with `Layer.mergeAll` (DOM, router, HTTP)
- A large Elm-style action bus (`Queue`) with many action variants covering the full RealWorld spec
- One `Ref` per piece of state, snapshotted together with `Effect.all` before each render
- JWT token management threaded through `HttpClientRequest` headers via app state
- `HttpClient` used directly (without `HTTPSink`/`HTTPSource`) for complex request patterns
- `RouterDriverLive` and `RouterConfigDefault` wiring

## Key files

| File | Description |
|------|-------------|
| `src/App.ts` | Full application: domain types, action union, state refs, HTTP calls, event delegation, and render pipeline |
| `src/main.ts` | Layer composition for DOM, router, and `FetchHttpClient` drivers |
| `src/styles.css` | Conduit reference stylesheet |
