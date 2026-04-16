# HTTP Search

A debounced search box that fires live HTTP requests as the user types. It demonstrates the full `HTTPSink`/`HTTPSource` request-response cycle: keystrokes flow through `DOMSource`, are debounced and mapped to `HttpClientRequest` values, dispatched to `HTTPSink` under a named category, and the responses are streamed back from `HTTPSource` and rendered by `DOMSink`.

## Getting started

```sh
pnpm dev
```

The dev server starts at `http://localhost:5173`. The app proxies `/api/search` requests to whatever backend you configure via the `HTTP_BASE_URL` environment variable (defaults work for local development).

## What it demonstrates

- `HTTPSink.request(category, stream)` for dispatching named request streams
- `HTTPSource.response(category)` for receiving the matching response stream
- `Stream.debounce` for rate-limiting user input before making network calls
- `HTTPDriverConfigured` reading base URL, timeout, and retry config from `ConfigProvider`
- `FetchHttpClient.layer` as the underlying HTTP transport
- Error handling at two levels: `Effect.orElse` for body-read errors, `Stream.catchAll` for `HTTPError`
- Composing multiple driver layers with `Layer.merge`

## Key files

| File | Description |
|------|-------------|
| `src/App.ts` | Event selection, request construction, response rendering, and error handling |
| `src/main.ts` | DOM and HTTP driver layer composition using `HTTPDriverConfigured` and `FetchHttpClient` |
