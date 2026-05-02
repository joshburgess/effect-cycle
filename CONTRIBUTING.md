# Contributing to effect-cycle

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9

The `dom` and `http` packages depend on [aeon](https://github.com/joshburgess/aeon), which is published to npm and pulled in via `pnpm install`.

## Setup

```bash
pnpm install
pnpm build       # Rollup + tsc for all packages (dual ESM+CJS)
pnpm test        # should show all tests passing
```

## Commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages (Rollup + SWC bundle, tsc declarations) |
| `pnpm test` | Run Vitest across all packages |
| `pnpm typecheck` | `tsc --noEmit` across packages and examples |
| `pnpm lint` | Biome lint + format check |
| `pnpm lint:fix` | Auto-fix lint/format issues |
| `pnpm size` | Check bundle sizes against limits (requires build first) |
| `pnpm changeset` | Create a changeset for your changes |

## Project Structure

```
packages/
  core/       App type, run, HMR, observability, metrics
  dom/        DOM driver (DOMSource, DOMSink, morphdom, isolation)
  http/       HTTP driver (adapter-based routing, @effect/platform)
  ws/         WebSocket driver (managed lifecycle)
  router/     Router driver (hash/history modes)
  testing/    Test doubles for all drivers
  devtools/   Instrumentation (metrics, spans, logging)

examples/
  counter/        Minimal DOM counter with Vite HMR
  http-search/    Debounced HTTP search
  ws-chat/        WebSocket chat
  todomvc/        TodoMVC with component isolation
  realworld/      Full Conduit SPA (DOM + Router + HttpClient)
  realworld-api/  Mock API server for the RealWorld example
```

## Conventions

### TypeScript

- Target ES2022, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`
- `.js` extensions in all imports (e.g., `import { foo } from "./foo.js"`)
- `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
- No `any` (Biome enforces this)

### Effect Patterns

- Services use `class extends Context.Tag(...)`:
  ```typescript
  class FooSource extends Context.Tag("effect-cycle/FooSource")<
    FooSource,
    { readonly bar: (x: string) => Stream.Stream<number> }
  >() {}
  ```
- Layers: `Layer.scoped(Tag, Effect.gen(...))` for resources, `Layer.scopedContext` when providing multiple tags from one resource
- Errors: `class FooError extends Data.TaggedError("FooError")<{...}> {}`
- Testing: `it.effect` from `@effect/vitest`, layer swapping (no mock libraries)

### Naming

- Tag strings: `"effect-cycle/DOMSource"`, `"effect-cycle/HTTPSink"`, etc.
- Package names: `effect-cycle-core`, `effect-cycle-dom`, etc.
- Live layers: `FooDriverLive`
- Test factories: `TestFooSource(config)` (functions returning Layers)
- Default configs: `FooConfigDefault`

### Build

Every package uses the same build command:

```bash
rm -rf dist && rollup -c rollup.config.mjs && tsc -p tsconfig.build.json && cp dist/index.d.ts dist/index.d.cts
```

### Testing

- Use `@effect/vitest` with `it.effect` for Effect-based tests
- Use `fast-check` v4 for property-based tests
- Test files go in `packages/<name>/test/` with `.test.ts` suffix
- Property test files use `.prop.test.ts` suffix
- Tests requiring a DOM environment use `// @vitest-environment jsdom`

### Tooling

- **Biome** for linting and formatting (not ESLint/Prettier)
- **Rollup + SWC** for bundling
- **tsc** for type declarations only (`emitDeclarationOnly`)
- **Vitest** for tests
- **size-limit** for bundle size tracking

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

Before submitting a PR that changes any package, run:

```bash
pnpm changeset
```

Select the affected packages, choose the bump type, and write a summary. Commit the generated changeset file with your PR.

## Design Reference

See [DESIGN.md](DESIGN.md) for the full architecture and design decisions.
