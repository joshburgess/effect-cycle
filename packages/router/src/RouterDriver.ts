/**
 * RouterDriverLive -- bridges the browser History/hash API to Effect Streams.
 *
 * Supports two modes:
 *   - "hash": reads/writes window.location.hash (e.g. "#/articles/foo")
 *   - "history": reads/writes the real URL path via pushState/replaceState
 *
 * The source emits a RouteLocation on every navigation event. The sink
 * accepts Navigation commands and applies them to the browser.
 *
 * Navigation commands from the sink also trigger the source to emit,
 * since pushState/replaceState do not fire popstate on their own.
 */
import { Context, Effect, Layer, Option, Queue, Stream } from "effect"
import { RouterError } from "./errors.js"
import { type RouteLocation, matchPath, parseQuery } from "./Location.js"
import type { Navigation } from "./Navigation.js"
import { RouterConfig } from "./RouterConfig.js"
import { RouterSink } from "./RouterSink.js"
import { RouterSource } from "./RouterSource.js"

// ---------------------------------------------------------------------------
// Internal: read current location from the browser
// ---------------------------------------------------------------------------

const readLocation = (mode: "hash" | "history", base: string): RouteLocation => {
  if (mode === "hash") {
    const raw = window.location.hash.slice(1) || "/"
    const qIdx = raw.indexOf("?")
    const path = qIdx === -1 ? raw : raw.slice(0, qIdx)
    const search = qIdx === -1 ? "" : raw.slice(qIdx)
    return {
      path: stripBase(path, base),
      query: parseQuery(search),
      hash: "",
    }
  }
  // history mode
  return {
    path: stripBase(window.location.pathname, base),
    query: parseQuery(window.location.search),
    hash: window.location.hash,
  }
}

const stripBase = (path: string, base: string): string => {
  if (base.length === 0) return path
  if (path.startsWith(base)) return path.slice(base.length) || "/"
  return path
}

// ---------------------------------------------------------------------------
// Driver Layer
// ---------------------------------------------------------------------------

export const RouterDriverLive: Layer.Layer<RouterSource | RouterSink, never, RouterConfig> =
  Layer.scopedContext(
    Effect.gen(function* () {
      const config = yield* RouterConfig

      // Queue acts as a broadcast channel: both popstate events and
      // programmatic navigations push into it, and the source stream
      // drains it.
      const locationQueue = yield* Queue.unbounded<RouteLocation>()

      // Push the initial location
      const initial = yield* Effect.sync(() => readLocation(config.mode, config.base))
      yield* Queue.offer(locationQueue, initial)

      // Listen to browser navigation events
      const eventName = config.mode === "hash" ? "hashchange" : "popstate"
      const onNav = () => {
        const loc = readLocation(config.mode, config.base)
        void Effect.runPromise(Queue.offer(locationQueue, loc))
      }

      yield* Effect.sync(() => {
        window.addEventListener(eventName, onNav)
      })

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          window.removeEventListener(eventName, onNav)
        }),
      )

      // Apply a navigation command to the browser
      const applyNav = (nav: Navigation): Effect.Effect<void, RouterError> =>
        Effect.try({
          try: () => {
            switch (nav.type) {
              case "push": {
                if (config.mode === "hash") {
                  window.location.hash = `#${nav.path}`
                  // hashchange fires automatically, so the listener will push to the queue
                } else {
                  history.pushState(null, "", config.base + nav.path)
                  // pushState does NOT fire popstate, so we push manually
                  onNav()
                }
                break
              }
              case "replace": {
                if (config.mode === "hash") {
                  // Replace hash without adding a history entry
                  const url = `${window.location.href.replace(/#.*$/, "")}#${nav.path}`
                  history.replaceState(null, "", url)
                  // replaceState doesn't fire hashchange, push manually
                  onNav()
                } else {
                  history.replaceState(null, "", config.base + nav.path)
                  onNav()
                }
                break
              }
              case "go": {
                history.go(nav.delta)
                // popstate will fire after the navigation completes
                break
              }
            }
          },
          catch: (cause) =>
            new RouterError({
              message: `Navigation failed (${nav.type}): ${cause instanceof Error ? cause.message : String(cause)}`,
            }),
        })

      // Build the location stream from the queue
      const location$ = Stream.fromQueue(locationQueue)

      // Source implementation
      const source: RouterSource["Type"] = {
        location$,

        currentLocation: Effect.sync(() => readLocation(config.mode, config.base)),

        matchPath$: (pattern: string) =>
          location$.pipe(
            Stream.filterMap((loc) => {
              const params = matchPath(pattern, loc.path)
              return params === undefined
                ? Option.none()
                : Option.some(params as Readonly<Record<string, string>>)
            }),
          ),
      }

      // Sink implementation
      const sink: RouterSink["Type"] = {
        navigate: (nav$) =>
          Stream.runForEach(nav$, applyNav).pipe(Effect.fork, Effect.asVoid),

        push: (path) => applyNav({ type: "push", path }),

        replace: (path) => applyNav({ type: "replace", path }),
      }

      return Context.empty().pipe(Context.add(RouterSource, source), Context.add(RouterSink, sink))
    }),
  )
