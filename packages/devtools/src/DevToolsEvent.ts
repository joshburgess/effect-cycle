import { Data } from "effect"

/**
 * Structured driver-activity event. The `DevToolsBus` (when
 * `enableEvents` is on) publishes one of these for every observable
 * source emission, sink invocation, or driver state change. Inspector
 * panels and user-built tooling subscribe to the bus's `events` stream
 * and pattern-match on the tag.
 *
 * Field shape is intentionally narrow: small, JSON-friendly previews
 * rather than the underlying DOM/HTTP/WS objects, so events can cross a
 * postMessage boundary into a panel without serialisation surprises.
 *
 * @since 0.1.0
 */
export type DevToolsEvent = Data.TaggedEnum<{
  /** A `DOMSource.select` stream emitted one DOM event. */
  readonly DOMEvent: {
    readonly at: number
    readonly selector: string
    readonly eventType: string
    readonly eventName: string
  }
  /** A `DOMSink.render` stream emitted one VNode (or HTML string). */
  readonly DOMRender: {
    readonly at: number
  }
  /** `HTTPSink.request` dispatched one request under a category. */
  readonly HTTPRequest: {
    readonly at: number
    readonly category: string
    readonly url: string
  }
  /** `HTTPSource.response(category)` emitted one response. */
  readonly HTTPResponse: {
    readonly at: number
    readonly category: string
    readonly status: number
  }
  /** `HTTPSource.errors(category)` emitted one error. */
  readonly HTTPRequestError: {
    readonly at: number
    readonly category: string
    readonly status: number
    readonly url: string
  }
  /** `WSSource.messages` emitted one inbound message. */
  readonly WSMessageReceived: {
    readonly at: number
    readonly dataPreview: string
  }
  /** `WSSink.send` flushed one outbound message. */
  readonly WSMessageSent: {
    readonly at: number
    readonly dataPreview: string
  }
  /** `RouterSource.location$` emitted a new location. */
  readonly RouterNavigation: {
    readonly at: number
    readonly path: string
  }
  /** `RouterSink.push` was called. */
  readonly RouterPush: {
    readonly at: number
    readonly path: string
  }
  /** `RouterSink.replace` was called. */
  readonly RouterReplace: {
    readonly at: number
    readonly path: string
  }
}>

/**
 * Constructors and pattern-matchers for `DevToolsEvent`.
 *
 * @since 0.1.0
 */
export const DevToolsEvent = Data.taggedEnum<DevToolsEvent>()
