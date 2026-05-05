# effect-cycle-ws

WebSocket driver for [effect-cycle](https://github.com/joshburgess/effect-cycle).

## Install

```sh
pnpm add effect-cycle-ws effect-cycle-core effect
```

## Usage

```ts
import { Effect, Stream } from "effect"
import { WSSink, WSSource } from "effect-cycle-ws"

const app = Effect.gen(function* () {
  const ws = yield* WSSource
  const send = yield* WSSink

  yield* Stream.runForEach(ws.messages, (msg) =>
    Effect.log(`recv: ${msg.data}`),
  )

  yield* send.send(Stream.make("hello"))
})
```

`WSDriverLive` opens the socket lazily on first subscription and tears it down with the surrounding `Scope`. See `validatedMessageEffect` for `Schema`-decoded inbound messages.

See the [main README](https://github.com/joshburgess/effect-cycle#readme) and [DESIGN.md](https://github.com/joshburgess/effect-cycle/blob/main/DESIGN.md) for the full design.

## License

MIT © Josh Burgess
