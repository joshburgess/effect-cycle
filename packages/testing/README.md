# effect-cycle-testing

Test doubles for [effect-cycle](https://github.com/joshburgess/effect-cycle) drivers. Layer-swap your live drivers for these in tests — no mocking library required.

## Install

```sh
pnpm add -D effect-cycle-testing effect-cycle-core effect
```

## What's in the box

- `TestDOMSource(events)` — script DOM events per selector.
- `TestDOMSink<Id, V>(tag)` — capture rendered VNodes per renderer.
- `TestHTTPSource(...)` / `TestHTTPSink(...)` — script responses, capture requests.
- `TestWSSource(messages)` / `TestWSSink()` — script inbound, capture outbound.
- `TestRouterSource(locations)` / `TestRouterSink()` — script navigations, capture pushes/replaces.
- `runTest(...)` — convenience runner that pairs `it.effect` with `TestClock`.

## Usage

```ts
import { it } from "@effect/vitest"
import { Effect, Layer, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { TestDOMSource } from "effect-cycle-testing"

it.effect("counts clicks", () =>
  Effect.gen(function* () {
    const dom = yield* DOMSource
    const events = yield* Stream.runCollect(dom.select(".btn", "click"))
    expect(events.length).toBe(2)
  }).pipe(
    Effect.provide(
      TestDOMSource({ ".btn": [new Event("click"), new Event("click")] }),
    ),
  ),
)
```

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
