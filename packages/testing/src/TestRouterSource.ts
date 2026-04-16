import { Effect, Layer, Option, Stream } from "effect"
import type { RouteLocation } from "effect-cycle-router"
import { RouterSource, matchPath } from "effect-cycle-router"

/**
 * Creates a test `RouterSource` layer that replays scripted route locations.
 *
 * The `location$` stream emits each location in order.
 * `currentLocation` returns the last location in the array (or "/" if empty).
 * `matchPath$` filters the scripted locations against the given pattern.
 *
 * @param locations - An array of `RouteLocation` values to emit.
 * @returns A `Layer` providing `RouterSource` with the scripted locations.
 *
 * @since 0.1.0
 */
export const TestRouterSource = (
  locations: ReadonlyArray<RouteLocation>,
): Layer.Layer<RouterSource> => {
  const last: RouteLocation =
    locations.length > 0 ? locations[locations.length - 1]! : { path: "/", query: {}, hash: "" }

  return Layer.succeed(RouterSource, {
    location$: Stream.fromIterable(locations),

    currentLocation: Effect.succeed(last),

    matchPath$: (pattern: string) =>
      Stream.fromIterable(locations).pipe(
        Stream.filterMap((loc) => {
          const params = matchPath(pattern, loc.path)
          return params === undefined
            ? Option.none()
            : Option.some(params as Readonly<Record<string, string>>)
        }),
      ),
  })
}
