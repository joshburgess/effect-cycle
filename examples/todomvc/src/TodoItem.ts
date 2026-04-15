/**
 * TodoItem — an isolated child component for a single todo entry.
 *
 * This component is mounted via `isolate(TodoItem, namespace)` in App.ts.
 * When isolated, its DOMSource selectors are scoped to a `[data-ns="…"]`
 * subtree, preventing it from accidentally matching elements from other todos.
 *
 * The component is an Effect that consumes DOMSource and DOMSink — just like
 * the root app.  Isolation is purely a concern of the parent.
 */
import { Effect, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"

// The shape of a single todo item, shared with App.ts.
export interface Todo {
  readonly id: number
  readonly text: string
  readonly done: boolean
}

/**
 * A single todo item component.
 *
 * Receives a Ref to the shared todo list so it can mutate its own entry
 * without knowing about the rest of the list.  The parent (App) passes
 * this in rather than using a global, keeping data flow explicit.
 *
 * @param todo   - The initial snapshot of this item's data
 * @param todos  - The shared Ref<Array<Todo>> from the parent
 */
export const TodoItem = (
  todo: Todo,
  todos: Ref.Ref<ReadonlyArray<Todo>>,
): Effect.Effect<void, never, DOMSource | DOMSink> =>
  Effect.gen(function* () {
    // Inside an isolate() call, DOMSource is scoped to [data-ns="todo-<id>"].
    // Selectors here only match within that subtree.
    const dom = yield* DOMSource
    const sink = yield* DOMSink

    // Toggle: flip the `done` flag for this specific todo id.
    const toggle$ = dom
      .select(".toggle")
      .pipe(
        Stream.tap(() =>
          Ref.update(todos, (items) =>
            items.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
          ),
        ),
      )

    // Delete: remove this todo from the list entirely.
    const delete$ = dom
      .select(".delete")
      .pipe(Stream.tap(() => Ref.update(todos, (items) => items.filter((t) => t.id !== todo.id))))

    // Merge toggle and delete events, then re-read the list to find this item's
    // current state and produce an updated VNode.
    const vdom$ = Stream.mergeAll([toggle$, delete$], { concurrency: "unbounded" }).pipe(
      Stream.mapEffect(() => Ref.get(todos)),
      Stream.map((items) => {
        // After a delete the item will no longer be in the list — render nothing.
        const current = items.find((t) => t.id === todo.id)
        if (current === undefined) return ""

        const doneClass = current.done ? " done" : ""

        // The `data-ns` attribute is written by the parent's shell template.
        // This VNode fills in the content inside the namespaced container.
        return `<li class="todo-item${doneClass}">
          <input class="toggle" type="checkbox" ${current.done ? "checked" : ""} />
          <span class="todo-text">${current.text}</span>
          <button class="delete" type="button">✕</button>
        </li>`
      }),
    )

    yield* sink.render(vdom$)
  })
