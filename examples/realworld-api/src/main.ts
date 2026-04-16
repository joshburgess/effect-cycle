/**
 * RealWorld API server entry point.
 *
 * Composes all handler layers, the in-memory store, auth middleware, and
 * the Node.js HTTP server into a single runnable program.
 */
import { createServer } from "node:http"
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { RealWorldApi } from "./Api.js"
import { AuthMiddlewareLive } from "./Auth.js"
import {
  ArticlesGroupLive,
  CommentsGroupLive,
  FavoritesGroupLive,
  ProfilesGroupLive,
  TagsGroupLive,
  UsersGroupLive,
} from "./Handlers.js"
import { StoreLive } from "./Store.js"

const PORT = 4100

// Compose all handler group layers
const HandlersLive = Layer.mergeAll(
  UsersGroupLive,
  ProfilesGroupLive,
  ArticlesGroupLive,
  CommentsGroupLive,
  FavoritesGroupLive,
  TagsGroupLive,
)

// The top-level API layer
const ApiLive = HttpApiBuilder.api(RealWorldApi)

// Node.js HTTP server layer
const ServerLive = NodeHttpServer.layer(() => createServer(), { port: PORT })

// Full application layer
const AppLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(HandlersLive),
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(StoreLive),
  Layer.provide(ServerLive),
)

const program = Effect.gen(function* () {
  yield* Layer.launch(AppLive)
  yield* Effect.log(`RealWorld API server listening on http://localhost:${PORT}`)
  yield* Effect.never
})

NodeRuntime.runMain(program)
