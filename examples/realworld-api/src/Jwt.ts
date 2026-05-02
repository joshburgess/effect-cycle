/**
 * Minimal JWT implementation using Node.js crypto.
 *
 * Produces/verifies HS256 tokens without external dependencies.
 * All crypto and time-reading operations are wrapped in Effect.
 */
import { createHmac } from "node:crypto"
import { Data, Effect, Option, Schema } from "effect"

const SECRET = "realworld-effect-cycle-secret"
const ALGORITHM = "HS256"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class JwtError extends Data.TaggedError("JwtError")<{
  readonly reason: string
}> {}

// ---------------------------------------------------------------------------
// Helpers (pure: no side effects, no exceptions for valid input)
// ---------------------------------------------------------------------------

const base64url = (data: string): string => Buffer.from(data).toString("base64url")

const base64urlDecode = (data: string): string => Buffer.from(data, "base64url").toString("utf-8")

const sign = (input: string): string =>
  createHmac("sha256", SECRET).update(input).digest("base64url")

// ---------------------------------------------------------------------------
// Schema (validates the decoded token payload)
// ---------------------------------------------------------------------------

export const JwtPayloadSchema = Schema.Struct({
  sub: Schema.Number,
  username: Schema.String,
  iat: Schema.Number,
  exp: Schema.Number,
})

export type JwtPayload = Schema.Schema.Type<typeof JwtPayloadSchema>

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const createToken = (userId: number, username: string): Effect.Effect<string> =>
  Effect.sync(() => {
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: ALGORITHM, typ: "JWT" }))
    const payload = base64url(
      JSON.stringify({
        sub: userId,
        username,
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
      }),
    )
    const signature = sign(`${header}.${payload}`)
    return `${header}.${payload}.${signature}`
  })

export const verifyToken = (token: string): Effect.Effect<JwtPayload, JwtError> =>
  Effect.gen(function* () {
    const parts = token.split(".")
    if (parts.length !== 3) {
      return yield* new JwtError({ reason: "Malformed token" })
    }
    const [header, payload, signature] = parts as [string, string, string]

    const expected = yield* Effect.sync(() => sign(`${header}.${payload}`))
    if (signature !== expected) {
      return yield* new JwtError({ reason: "Invalid signature" })
    }

    const raw = yield* Effect.try({
      try: () => JSON.parse(base64urlDecode(payload)) as unknown,
      catch: () => new JwtError({ reason: "Invalid token JSON" }),
    })

    const decoded = yield* Schema.decodeUnknown(JwtPayloadSchema)(raw).pipe(
      Effect.mapError(() => new JwtError({ reason: "Invalid token payload" })),
    )

    const now = yield* Effect.sync(() => Math.floor(Date.now() / 1000))
    if (decoded.exp < now) {
      return yield* new JwtError({ reason: "Token expired" })
    }
    return decoded
  })

/**
 * Try to verify a token, returning Option.none() on failure instead of an error.
 * Verification failures are logged at debug level so they remain observable
 * without breaking the optional-auth happy path.
 */
export const verifyTokenOptional = (token: string): Effect.Effect<Option.Option<JwtPayload>> =>
  verifyToken(token).pipe(
    Effect.map(Option.some),
    Effect.tapError((error) =>
      Effect.logDebug("Optional JWT verification failed").pipe(
        Effect.annotateLogs({ reason: error.reason }),
      ),
    ),
    Effect.catchAll(() => Effect.succeed(Option.none())),
  )
