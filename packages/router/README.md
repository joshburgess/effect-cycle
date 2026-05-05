# effect-cycle-router

Router driver for [effect-cycle](https://github.com/joshburgess/effect-cycle). Wraps the History API as a `RouterSource` (location stream) and a `RouterSink` (navigate / push / replace).

## Install

```sh
pnpm add effect-cycle-router effect-cycle-core effect
```

## Usage

```ts
import { Effect, Stream } from "effect"
import { RouterSink, RouterSource, matchPath } from "effect-cycle-router"

const app = Effect.gen(function* () {
  const router = yield* RouterSource
  const nav = yield* RouterSink

  yield* Stream.runForEach(router.location$, (loc) =>
    Effect.log(`nav: ${loc.path}`),
  )

  yield* nav.push("/about")
})
```

Use `matchPath(pattern, path)` for pattern-based route matching with typed params.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
