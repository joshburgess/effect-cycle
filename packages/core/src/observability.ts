import { type Context, Effect, Layer, Metric } from "effect"

// -------------------------------------------------------------------------------------
// withEffectSpan
// -------------------------------------------------------------------------------------

/**
 * Wraps an Effect-returning function with an Effect.withSpan call.
 * Useful for instrumenting driver service methods.
 */
export const withEffectSpan =
  <Args extends ReadonlyArray<unknown>, A, E, R>(
    name: string,
    fn: (...args: Args) => Effect.Effect<A, E, R>,
  ): ((...args: Args) => Effect.Effect<A, E, R>) =>
  (...args) =>
    fn(...args).pipe(Effect.withSpan(name))

// -------------------------------------------------------------------------------------
// Pre-built metrics
// -------------------------------------------------------------------------------------

/** Counter: total HTTP requests sent */
export const httpRequestCount = Metric.counter("effect_cycle.http.requests.total")

/** Counter: total HTTP errors */
export const httpErrorCount = Metric.counter("effect_cycle.http.errors.total")

/** Counter: total WebSocket messages received */
export const wsMessageCount = Metric.counter("effect_cycle.ws.messages.received")

/** Counter: total WebSocket messages sent */
export const wsSendCount = Metric.counter("effect_cycle.ws.messages.sent")

/** Counter: total DOM events captured */
export const domEventCount = Metric.counter("effect_cycle.dom.events.total")

/** Counter: total DOM renders */
export const domRenderCount = Metric.counter("effect_cycle.dom.renders.total")

/** Counter: total router navigations */
export const routerNavCount = Metric.counter("effect_cycle.router.navigations.total")

// -------------------------------------------------------------------------------------
// instrumentService: generic service wrapper
// -------------------------------------------------------------------------------------

/**
 * Wraps methods of any Context service with custom wrappers, producing a new Layer
 * that reads the existing service and provides an instrumented version.
 *
 * Only the keys present in `wrappers` are replaced; all other methods are passed
 * through unchanged.
 *
 * @example
 * ```ts
 * const instrumented = instrumentService(MyTag, {
 *   doWork: (original) => withEffectSpan("my-service.doWork", original),
 * })
 * ```
 */
export const instrumentService = <Id, Service extends object>(
  tag: Context.Tag<Id, Service>,
  wrappers: Partial<{ [K in keyof Service]: (original: Service[K]) => Service[K] }>,
): Layer.Layer<Id, never, Id> =>
  Layer.effect(
    tag,
    Effect.gen(function* () {
      const service = yield* tag
      const patched = { ...service } as Service
      // The per-key call is hoisted into a generic function so K is captured
      // on each iteration; otherwise TS widens to keyof Service and the
      // function-union vs. value-union variance prevents the assignment.
      const patchKey = <K extends keyof Service>(
        key: K,
        wrap: (orig: Service[K]) => Service[K],
      ) => {
        patched[key] = wrap(service[key])
      }
      for (const key of Object.keys(wrappers) as Array<keyof Service>) {
        const wrapper = wrappers[key]
        if (wrapper !== undefined) {
          patchKey(key, wrapper)
        }
      }
      return patched
    }),
  )
