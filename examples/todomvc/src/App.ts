/**
 * TodoMVC — demonstrates component isolation with effect-cycle.
 *
 * Key concepts shown here:
 *   - Ref<Array<Todo>> as shared state between parent and child components
 *   - `isolate(component, namespace)` scopes each TodoItem's DOMSource to its
 *     own `[data-ns="todo-<id>"]` container, preventing selector collisions
 *   - The parent renders the shell HTML with [data-ns] containers; each isolated
 *     TodoItem component mounts into its container and handles its own re-renders
 *   - Effect.fork lets child component fibers run concurrently with the shell loop
 *
 * Architecture note:
 *   DOMSink.render expects a `Stream<VNode, never, never>` — no errors, no services.
 *   Because `isolate` requires DOMSource + DOMSink in scope, it cannot be called
 *   inside the vdom$ stream (stream channels must be service-free by the time we
 *   call render).
 *
 *   Solution: the "add todo" workflow is split into two independent forked fibers:
 *     1. A DOM listener that reads new text values and pushes them to a Queue
 *     2. A component mounter that drains the Queue, updates state, and forks
 *        an isolated TodoItem for each new todo
 *   The parent's vdom$ is driven by a separate notification Queue so the shell
 *   re-renders after every add.
 */
import { Effect, Queue, Ref, Stream } from "effect"
import { DOMSink, DOMSource, isolate } from "effect-cycle-dom"
import { type Todo, TodoItem } from "./TodoItem.js"

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink

  // Shared mutable state for the entire todo list.
  // Both the parent and each isolated TodoItem hold a reference to this Ref.
  const todos = yield* Ref.make<ReadonlyArray<Todo>>([])

  // Auto-incrementing ID counter managed as a Ref.
  const nextId = yield* Ref.make(1)

  // Queue used by the DOM listener to hand off new todo text to the mounter fiber.
  const textQueue = yield* Queue.unbounded<string>()

  // Queue used by the mounter fiber to signal the render loop after each add.
  // We send the current version number so the render loop can detect new renders.
  const renderQueue = yield* Queue.unbounded<void>()

  // Fiber 1: DOM listener.
  // Reads the add-btn click stream and pushes the typed text into textQueue.
  // Runs independently of the render and mount fibers.
  yield* dom.select(".add-btn", "click").pipe(
    Stream.mapEffect((event) =>
      Effect.sync(() => {
        const form = (event.target as HTMLElement).closest("form") as HTMLFormElement | null
        const input = form?.querySelector(".new-todo") as HTMLInputElement | null
        const text = input?.value.trim() ?? ""

        if (input !== null) {
          input.value = ""
        }

        return text
      }),
    ),
    Stream.filter((text): text is string => text.length > 0),
    Stream.runForEach((text) => Queue.offer(textQueue, text)),
    Effect.fork,
  )

  // Fiber 2: Component mounter.
  // Drains textQueue, updates the todos Ref, forks an isolated TodoItem,
  // and signals the render loop via renderQueue.
  // This fiber runs with DOMSource + DOMSink in scope, so it can call isolate().
  yield* Stream.fromQueue(textQueue).pipe(
    Stream.runForEach((text) =>
      Effect.gen(function* () {
        const id = yield* Ref.getAndUpdate(nextId, (n) => n + 1)
        const todo: Todo = { id, text, done: false }

        // Add to the shared list first so the shell re-render sees the new container.
        yield* Ref.update(todos, (items: ReadonlyArray<Todo>) => [...items, todo])

        // Signal the shell render loop.
        yield* Queue.offer(renderQueue, undefined)

        // Fork an isolated child component that owns its own [data-ns] subtree.
        // isolate() will fail with DOMError if the container isn't in the DOM yet —
        // in a real app we'd retry or use a smarter mounting strategy.
        yield* isolate(TodoItem(todo, todos), `todo-${id}`).pipe(
          Effect.catchAll(() => Effect.void),
          Effect.fork,
        )
      }),
    ),
    Effect.fork,
  )

  // The parent vdom$ re-renders whenever renderQueue emits.
  // Stream.fromQueue gives an infinite stream that emits one item per queue offer.
  // We prepend a synthetic initial tick so the shell renders immediately on startup.
  const vdom$: Stream.Stream<string> = Stream.concat(
    Stream.sync(() => undefined as undefined),
    Stream.fromQueue(renderQueue),
  ).pipe(
    Stream.mapEffect((): Effect.Effect<ReadonlyArray<Todo>> => Ref.get(todos)),
    Stream.map((items: ReadonlyArray<Todo>) => {
      // The shell provides one [data-ns] container per todo.
      // Isolated TodoItem fibers render into these containers.
      const listItems = items
        .map((todo: Todo) => `<div data-ns="todo-${todo.id}" class="todo-container"></div>`)
        .join("")

      return `<div class="todomvc">
        <h1>TodoMVC</h1>
        <form class="add-form">
          <input class="new-todo" type="text" placeholder="What needs to be done?" />
          <button class="add-btn" type="button">Add</button>
        </form>
        <ul class="todo-list">
          ${listItems}
        </ul>
        <p class="count">${items.filter((t: Todo) => !t.done).length} item(s) remaining</p>
      </div>`
    }),
  )

  yield* sink.render(vdom$)
})

export default app
