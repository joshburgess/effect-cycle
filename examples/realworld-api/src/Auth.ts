import { HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
/**
 * Authentication middleware for the RealWorld API.
 *
 * Uses HttpApiMiddleware.Tag with bearer token security. The middleware
 * decodes the JWT and provides a CurrentUser context to downstream handlers.
 */
import { Context, Effect, Layer, Redacted, Ref } from "effect"
import type { StoredUser } from "./Domain.js"
import { verifyToken } from "./Jwt.js"
import { Store } from "./Store.js"

// ---------------------------------------------------------------------------
// CurrentUser context
// ---------------------------------------------------------------------------

export class CurrentUser extends Context.Tag("effect-cycle/realworld/CurrentUser")<
  CurrentUser,
  StoredUser
>() {}

// ---------------------------------------------------------------------------
// Auth middleware (required)
// ---------------------------------------------------------------------------

export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()("AuthMiddleware", {
  failure: HttpApiError.Unauthorized,
  provides: CurrentUser,
  security: { bearer: HttpApiSecurity.bearer },
}) {}

export const AuthMiddlewareLive: Layer.Layer<AuthMiddleware, never, Store> = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const store = yield* Store
    return {
      bearer: (token: Redacted.Redacted) =>
        Effect.gen(function* () {
          const raw = Redacted.value(token)
          const payload = yield* verifyToken(raw).pipe(
            Effect.tapError((err) =>
              Effect.logDebug("JWT verification failed").pipe(
                Effect.annotateLogs({ reason: err.reason }),
              ),
            ),
            Effect.catchAll(() => Effect.fail(new HttpApiError.Unauthorized())),
          )
          const users = yield* Ref.get(store.users)
          const user = users.find((u) => u.id === payload.sub)
          if (!user) {
            return yield* Effect.fail(new HttpApiError.Unauthorized())
          }
          return user
        }),
    }
  }),
)
