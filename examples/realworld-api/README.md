# RealWorld API

A Node.js HTTP server implementing the [RealWorld backend spec](https://github.com/gothinkster/realworld) using `@effect/platform`'s `HttpApi` DSL. All 19 endpoints are declared with typed request and response schemas, wired to in-memory handlers, and protected by JWT middleware where required. This server is the backend companion for the `realworld` frontend example.

## Getting started

```sh
pnpm start
```

The server listens on `http://localhost:4100`. No database is needed -- all data is stored in an in-memory `Store` layer that resets when the process restarts.

## What it demonstrates

- `HttpApi.make` and `HttpApiGroup` for declaring a typed REST API
- `HttpApiEndpoint` for defining routes with typed path params, query params, payloads, and response schemas
- `HttpApiBuilder.api` and `HttpApiBuilder.serve` for building and serving the API as a layer
- `HttpMiddleware` (JWT auth) wired per-endpoint via `.middleware(AuthMiddleware)`
- `Layer.mergeAll` for composing handler group layers
- `NodeHttpServer.layer` and `NodeRuntime.runMain` for running on Node.js
- `Effect.Schema` for domain types and validation in `Domain.ts`
- In-memory `Store` as a `Layer`-provided service for handler state

## Key files

| File | Description |
|------|-------------|
| `src/main.ts` | Layer composition, server startup on port 4100 |
| `src/Api.ts` | All 19 endpoint and group declarations with typed schemas |
| `src/Domain.ts` | Schema definitions for all request and response types |
| `src/Handlers.ts` | Handler layer implementations for each API group |
| `src/Auth.ts` | JWT `AuthMiddleware` layer |
| `src/Store.ts` | In-memory data store layer |
| `src/Jwt.ts` | JWT signing and verification utilities |
| `src/Password.ts` | Password hashing utilities |
