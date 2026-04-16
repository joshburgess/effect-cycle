# WebSocket Chat

A real-time chat application that demonstrates bidirectional WebSocket communication in effect-cycle. Incoming messages are accumulated in a `Ref`-backed list, outgoing messages are sent via `WSSink`, and the entire message list is re-rendered on every state change using `DOMSink`. The WebSocket URL is injected through the layer system, so the app never hard-codes infrastructure details.

## Getting started

Start a local WebSocket echo server on `ws://localhost:8080`, then run:

```sh
pnpm dev
```

The `WS_URL` environment variable can be set to point at any WebSocket server. The example defaults to `ws://localhost:8080` for local development.

## What it demonstrates

- `WSSource.connected` for awaiting the WebSocket handshake before proceeding
- `WSSource.messages` as a `Stream<MessageEvent>` of incoming frames
- `WSSink.send` for dispatching an outgoing `Stream<string>` to the socket
- `Effect.fork` for running message accumulation concurrently with event handling
- `Stream.orElse` for graceful handling of WebSocket disconnects
- `WSConfigFromEnv` for reading `WS_URL` from `ConfigProvider`
- `ConfigProvider.orElse` for providing development-time defaults alongside process env

## Key files

| File | Description |
|------|-------------|
| `src/App.ts` | Connection setup, message accumulation, outgoing send stream, and render loop |
| `src/main.ts` | Layer composition for DOM and WebSocket drivers, with dev-default config |
