import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Fiber, Layer, Stream } from "effect"
import { HTTPDriverLive, HTTPError, HTTPSink, HTTPSource } from "effect-cycle-http"

// ---------------------------------------------------------------------------
// Mock HttpClient
// ---------------------------------------------------------------------------

/**
 * Creates a mock HttpClient layer that returns scripted responses based on URL.
 */
const makeMockHttpClient = (
  handler: (request: HttpClientRequest.HttpClientRequest) => Response,
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.succeed(HttpClientResponse.fromWeb(request, handler(request))),
    ),
  )

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HTTPDriverLive", () => {
  it.effect("routes responses to the correct category", () =>
    Effect.gen(function* () {
      const mockLayer = makeMockHttpClient((req) => {
        if (req.url.includes("/users")) {
          return new Response(JSON.stringify({ id: 1, name: "Alice" }), { status: 200 })
        }
        return new Response("not found", { status: 404 })
      })

      const layer = HTTPDriverLive.pipe(Layer.provide(mockLayer))

      const result = yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("https://api.example.com/users")

        // Subscribe first, then send the request
        const collectFiber = yield* source
          .response("users")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("users", Stream.make(request))

        const chunk = yield* Fiber.join(collectFiber)
        return Chunk.toArray(chunk)
      }).pipe(Effect.provide(layer))

      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe(200)
    }),
  )

  it.effect("isolates responses by category", () =>
    Effect.gen(function* () {
      const mockLayer = makeMockHttpClient((req) => {
        if (req.url.includes("/users")) {
          return new Response(JSON.stringify({ id: 1 }), { status: 200 })
        }
        if (req.url.includes("/posts")) {
          return new Response(JSON.stringify({ id: 99 }), { status: 201 })
        }
        return new Response("", { status: 404 })
      })

      const layer = HTTPDriverLive.pipe(Layer.provide(mockLayer))

      const { postsArr, usersArr } = yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        // Subscribe to both categories before sending requests
        const usersCollectFiber = yield* source
          .response("users")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        const postsCollectFiber = yield* source
          .response("posts")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        const usersReq = HttpClientRequest.get("https://api.example.com/users")
        const postsReq = HttpClientRequest.get("https://api.example.com/posts")

        yield* sink.request("users", Stream.make(usersReq))
        yield* sink.request("posts", Stream.make(postsReq))

        const usersArr = Chunk.toArray(yield* Fiber.join(usersCollectFiber))
        const postsArr = Chunk.toArray(yield* Fiber.join(postsCollectFiber))

        return { usersArr, postsArr }
      }).pipe(Effect.provide(layer))

      expect(usersArr.length).toBe(1)
      expect(postsArr.length).toBe(1)
      expect(usersArr[0]?.status).toBe(200)
      expect(postsArr[0]?.status).toBe(201)
    }),
  )

  it.effect("does not leak responses across categories", () =>
    Effect.gen(function* () {
      const mockLayer = makeMockHttpClient((req) => {
        if (req.url.includes("/users")) {
          return new Response(JSON.stringify({ id: 1 }), { status: 200 })
        }
        return new Response("", { status: 404 })
      })

      const layer = HTTPDriverLive.pipe(Layer.provide(mockLayer))

      yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        // Subscribe to both categories before sending requests
        const usersCollectFiber = yield* source
          .response("users")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        const postsCollectFiber = yield* source
          .response("posts")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        // Only send to "users"; "posts" should get nothing
        const usersReq = HttpClientRequest.get("https://api.example.com/users")
        yield* sink.request("users", Stream.make(usersReq))

        // Wait for users response to arrive, confirming the timing
        const usersChunk = Chunk.toArray(yield* Fiber.join(usersCollectFiber))
        expect(usersChunk.length).toBe(1)
        expect(usersChunk[0]?.status).toBe(200)

        // The posts fiber is still waiting; it received nothing
        // Interrupt it and verify it was interrupted (blocked, not done)
        const postsFiberStatus = yield* Fiber.status(postsCollectFiber)
        expect(postsFiberStatus._tag).not.toBe("Done")

        yield* Fiber.interrupt(postsCollectFiber)
      }).pipe(Effect.provide(layer))
    }),
  )

  it.effect("500 responses are still delivered (not converted to HTTPError)", () =>
    Effect.gen(function* () {
      const mockLayer = makeMockHttpClient(
        () => new Response("internal server error", { status: 500 }),
      )

      const layer = HTTPDriverLive.pipe(Layer.provide(mockLayer))

      const result = yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("https://api.example.com/fail")

        const collectFiber = yield* source
          .response("fail")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("fail", Stream.make(request))

        const chunk = yield* Fiber.join(collectFiber)
        return Chunk.toArray(chunk)
      }).pipe(Effect.provide(layer))

      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe(500)
    }),
  )

  it("HTTPError has the correct shape", () => {
    const error = new HTTPError({ status: 404, body: "not found", url: "https://example.com" })
    expect(error._tag).toBe("HTTPError")
    expect(error.status).toBe(404)
    expect(error.body).toBe("not found")
    expect(error.url).toBe("https://example.com")
    expect(error).toBeInstanceOf(HTTPError)
  })
})
