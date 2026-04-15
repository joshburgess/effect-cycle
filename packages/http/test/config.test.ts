import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import { describe, expect, it } from "@effect/vitest"
import { Chunk, Config, ConfigProvider, Effect, Fiber, Layer, Ref, Stream } from "effect"
import { HTTPConfig, HTTPDriverConfigured, HTTPSink, HTTPSource } from "effect-cycle-http"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock HttpClient layer that captures requests and returns scripted
 * responses based on the provided handler.
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

/**
 * Creates a mock HttpClient layer that captures request URLs into a Ref for
 * later assertion.
 */
const makeCapturingHttpClient = (
  capturedUrls: Ref.Ref<Array<string>>,
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.flatMap(
        Ref.update(capturedUrls, (urls) => [...urls, request.url]),
        () =>
          Effect.succeed(HttpClientResponse.fromWeb(request, new Response("ok", { status: 200 }))),
      ),
    ),
  )

// ---------------------------------------------------------------------------
// HTTPConfig defaults
// ---------------------------------------------------------------------------

describe("HTTPConfig defaults", () => {
  it.effect("baseUrl defaults to empty string", () =>
    Effect.gen(function* () {
      const baseUrl = yield* HTTPConfig.baseUrl
      expect(baseUrl).toBe("")
    }),
  )

  it.effect("timeout defaults to 30000", () =>
    Effect.gen(function* () {
      const timeout = yield* HTTPConfig.timeout
      expect(timeout).toBe(30000)
    }),
  )

  it.effect("retries defaults to 0", () =>
    Effect.gen(function* () {
      const retries = yield* HTTPConfig.retries
      expect(retries).toBe(0)
    }),
  )

  it.effect("reads baseUrl from ConfigProvider", () =>
    Effect.gen(function* () {
      const baseUrl = yield* HTTPConfig.baseUrl
      expect(baseUrl).toBe("https://api.example.com")
    }).pipe(
      Effect.provide(
        Layer.setConfigProvider(
          ConfigProvider.fromMap(new Map([["HTTP_BASE_URL", "https://api.example.com"]])),
        ),
      ),
    ),
  )

  it.effect("reads timeout from ConfigProvider", () =>
    Effect.gen(function* () {
      const timeout = yield* HTTPConfig.timeout
      expect(timeout).toBe(5000)
    }).pipe(
      Effect.provide(
        Layer.setConfigProvider(ConfigProvider.fromMap(new Map([["HTTP_TIMEOUT_MS", "5000"]]))),
      ),
    ),
  )

  it.effect("reads retries from ConfigProvider", () =>
    Effect.gen(function* () {
      const retries = yield* HTTPConfig.retries
      expect(retries).toBe(3)
    }).pipe(
      Effect.provide(
        Layer.setConfigProvider(ConfigProvider.fromMap(new Map([["HTTP_RETRIES", "3"]]))),
      ),
    ),
  )
})

// ---------------------------------------------------------------------------
// HTTPDriverConfigured — base URL prepending
// ---------------------------------------------------------------------------

describe("HTTPDriverConfigured", () => {
  it.effect("prepends baseUrl to request URLs", () =>
    Effect.gen(function* () {
      const capturedUrls = yield* Ref.make<Array<string>>([])
      const mockLayer = makeCapturingHttpClient(capturedUrls)

      const testConfigProvider = Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map([["HTTP_BASE_URL", "https://api.example.com"]])),
      )

      const layer = HTTPDriverConfigured.pipe(
        Layer.provide(mockLayer),
        Layer.provide(testConfigProvider),
      )

      yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("/users")

        const collectFiber = yield* source
          .response("users")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("users", Stream.make(request))

        yield* Fiber.join(collectFiber)
      }).pipe(Effect.provide(layer))

      const urls = yield* Ref.get(capturedUrls)
      expect(urls.length).toBe(1)
      expect(urls[0]).toBe("https://api.example.com/users")
    }),
  )

  it.effect("does not modify URLs when baseUrl is empty string", () =>
    Effect.gen(function* () {
      const capturedUrls = yield* Ref.make<Array<string>>([])
      const mockLayer = makeCapturingHttpClient(capturedUrls)

      const layer = HTTPDriverConfigured.pipe(Layer.provide(mockLayer))

      yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("https://other.example.com/items")

        const collectFiber = yield* source
          .response("items")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("items", Stream.make(request))

        yield* Fiber.join(collectFiber)
      }).pipe(Effect.provide(layer))

      const urls = yield* Ref.get(capturedUrls)
      expect(urls.length).toBe(1)
      expect(urls[0]).toBe("https://other.example.com/items")
    }),
  )

  it.effect("delivers responses through source after configuration", () =>
    Effect.gen(function* () {
      const mockLayer = makeMockHttpClient(() => new Response("ok", { status: 200 }))

      const testConfigProvider = Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map([["HTTP_BASE_URL", "https://api.example.com"]])),
      )

      const layer = HTTPDriverConfigured.pipe(
        Layer.provide(mockLayer),
        Layer.provide(testConfigProvider),
      )

      const result = yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("/health")

        const collectFiber = yield* source
          .response("health")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("health", Stream.make(request))

        const chunk = yield* Fiber.join(collectFiber)
        return Chunk.toArray(chunk)
      }).pipe(Effect.provide(layer))

      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe(200)
    }),
  )

  it.effect("retries on failure when HTTP_RETRIES > 0", () =>
    Effect.gen(function* () {
      const callCount = yield* Ref.make(0)

      const mockLayer = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.flatMap(
            Ref.updateAndGet(callCount, (n) => n + 1),
            (count) => {
              if (count <= 2) {
                // Fail the first 2 attempts
                return Effect.fail(
                  new (class extends Error {
                    readonly _tag = "RequestError" as const
                    readonly request = request
                    readonly reason = "Transport" as const
                    readonly error = "network error"
                    readonly message = "network error"
                  })(),
                ) as never
              }
              return Effect.succeed(
                HttpClientResponse.fromWeb(request, new Response("ok", { status: 200 })),
              )
            },
          ),
        ),
      )

      const testConfigProvider = Layer.setConfigProvider(
        ConfigProvider.fromMap(new Map([["HTTP_RETRIES", "3"]])),
      )

      const layer = HTTPDriverConfigured.pipe(
        Layer.provide(mockLayer),
        Layer.provide(testConfigProvider),
      )

      const result = yield* Effect.gen(function* () {
        const sink = yield* HTTPSink
        const source = yield* HTTPSource

        const request = HttpClientRequest.get("https://api.example.com/data")

        const collectFiber = yield* source
          .response("data")
          .pipe(Stream.take(1), Stream.runCollect, Effect.fork)

        yield* sink.request("data", Stream.make(request))

        const chunk = yield* Fiber.join(collectFiber)
        return Chunk.toArray(chunk)
      }).pipe(Effect.provide(layer))

      const count = yield* Ref.get(callCount)
      expect(count).toBe(3)
      expect(result.length).toBe(1)
      expect(result[0]?.status).toBe(200)
    }),
  )
})
