# effect-cycle-http

HTTP driver for [effect-cycle](https://github.com/joshburgess/effect-cycle), built on `@effect/platform`'s `HttpClient`.

## Install

```sh
pnpm add effect-cycle-http effect-cycle-core effect @effect/platform
```

## Usage

```ts
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import { Effect, Stream } from "effect"
import { HTTPSink, HTTPSource } from "effect-cycle-http"

const app = Effect.gen(function* () {
  const httpSrc = yield* HTTPSource
  const httpSnk = yield* HTTPSink

  const req$ = Stream.make(HttpClientRequest.get("/api/users"))
  yield* httpSnk.request("users", req$)

  yield* Stream.runForEach(httpSrc.response("users"), (res) =>
    Effect.log(`status ${res.status}`),
  )
})
```

Requests are routed by category. `HTTPSource.response(category)` and `HTTPSource.errors(category)` are independent streams so successes and failures don't collapse into one channel. See `validatedResponseEffect` for `Schema`-decoded responses.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
