# TodoMVC

A complete TodoMVC implementation that showcases effect-cycle at a larger scale. Rather than attaching streams to individual elements, the app uses event delegation on the persistent root element and funnels every user interaction through an Effect `Queue` acting as a typed action bus. A single render stream drains the queue, applies each action to `Ref`-backed state, and maps the resulting state to HTML for `DOMSink` to patch into the DOM.

## Getting started

```sh
pnpm dev
```

The dev server starts at `http://localhost:5173`.

## What it demonstrates

- Event delegation via `DOMSource.element` for dynamically rendered lists
- `Queue.unbounded` as an Elm-style typed action bus
- `Stream.fromQueue` turning the action queue into a renderable stream
- A pure state reducer (`applyAction`) applied inside `Stream.tap`
- `Stream.concat` for emitting an initial render tick before any actions arrive
- `Effect.never` to keep the app fiber alive after the render loop forks
- Ref-per-field state management with `Effect.all` to snapshot all refs atomically

## Key files

| File | Description |
|------|-------------|
| `src/App.ts` | Domain types, state reducer, HTML view function, event delegation, and render pipeline |
| `src/main.ts` | DOM driver layer composition; only the DOM driver is needed for this example |
| `src/styles.css` | TodoMVC reference stylesheet |
