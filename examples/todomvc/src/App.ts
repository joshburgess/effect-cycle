/**
 * TodoMVC: effect-cycle showcase (tachys renderer)
 *
 * Demonstrates the full effect-cycle pattern in a single component:
 *   - DOMSource.element for event delegation on dynamic DOM
 *   - Effect Queue as an action bus (Elm-style)
 *   - Ref-based state management
 *   - Stream-driven rendering with the tachys vDOM renderer (`tachys/sync`)
 *
 * Architecture:
 *   Native event listeners on the root element push typed Actions into a Queue.
 *   A single Stream drains the Queue, applies each Action to Ref state, reads
 *   the updated state, and maps it to a tachys VNode tree for the DOM driver.
 *
 * Note on event handling:
 *   This example deliberately keeps the event-delegation pattern from the
 *   morphdom variant rather than switching to per-element `onClick`/`onChange`
 *   props. The tachys-rendered DOM bubbles events the same way real DOM does,
 *   so `addEventListener` on the persistent root + `closest`/`matches` still
 *   works without coupling rendering to event wiring.
 */
import { Effect, Queue, Ref, Stream } from "effect"
import { DOMSource } from "effect-cycle-dom"
import { DOMSink, type VNode } from "effect-cycle-tachys"
import { h } from "tachys/sync"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Todo {
  readonly id: number
  readonly text: string
  readonly completed: boolean
}

type Filter = "all" | "active" | "completed"

type Action =
  | { readonly type: "add"; readonly text: string }
  | { readonly type: "toggle"; readonly id: number }
  | { readonly type: "destroy"; readonly id: number }
  | { readonly type: "toggleAll"; readonly completed: boolean }
  | { readonly type: "clearCompleted" }
  | { readonly type: "setFilter"; readonly filter: Filter }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseTodoId = (el: HTMLElement | null): number | undefined => {
  const li = el?.closest(".todo-item") as HTMLElement | null
  const raw = li?.dataset["id"]
  if (raw === undefined) return undefined
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

// ---------------------------------------------------------------------------
// State reducer
// ---------------------------------------------------------------------------

const applyAction = (
  action: Action,
  todos: Ref.Ref<ReadonlyArray<Todo>>,
  currentFilter: Ref.Ref<Filter>,
  nextId: Ref.Ref<number>,
): Effect.Effect<void> => {
  switch (action.type) {
    case "add": {
      return Effect.gen(function* () {
        const id = yield* Ref.getAndUpdate(nextId, (n) => n + 1)
        yield* Ref.update(todos, (items) => [...items, { id, text: action.text, completed: false }])
      })
    }
    case "toggle":
      return Ref.update(todos, (items) =>
        items.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t)),
      )
    case "destroy":
      return Ref.update(todos, (items) => items.filter((t) => t.id !== action.id))
    case "toggleAll":
      return Ref.update(todos, (items) => items.map((t) => ({ ...t, completed: action.completed })))
    case "clearCompleted":
      return Ref.update(todos, (items) => items.filter((t) => !t.completed))
    case "setFilter":
      return Ref.set(currentFilter, action.filter)
  }
}

// ---------------------------------------------------------------------------
// View (tachys VNode tree)
// ---------------------------------------------------------------------------

const renderTodoItem = (todo: Todo): VNode =>
  h(
    "li",
    {
      key: todo.id,
      className: `todo-item${todo.completed ? " completed" : ""}`,
      "data-id": todo.id,
    },
    h("input", {
      className: "toggle",
      type: "checkbox",
      checked: todo.completed,
    }),
    h("label", null, todo.text),
    h("button", { className: "destroy" }),
  )

const renderMain = (todos: ReadonlyArray<Todo>, visible: ReadonlyArray<Todo>): VNode | null => {
  if (todos.length === 0) return null
  const allCompleted = todos.every((t) => t.completed)

  return h(
    "section",
    { className: "main" },
    h(
      "label",
      { className: "toggle-all-label" },
      h("input", { className: "toggle-all", type: "checkbox", checked: allCompleted }),
      h("span", null, "Mark all as complete"),
    ),
    h("ul", { className: "todo-list" }, visible.map(renderTodoItem)),
  )
}

const renderFilterLink = (filter: Filter, current: Filter, label: string): VNode =>
  h(
    "li",
    null,
    h(
      "a",
      {
        className: `filter-${filter}${filter === current ? " selected" : ""}`,
        href: "#",
      },
      label,
    ),
  )

const renderFooter = (
  todos: ReadonlyArray<Todo>,
  filter: Filter,
  activeCount: number,
  completedCount: number,
): VNode | null => {
  if (todos.length === 0) return null

  const children: Array<VNode> = [
    h(
      "span",
      { className: "todo-count" },
      h("strong", null, String(activeCount)),
      ` ${activeCount === 1 ? "item" : "items"} left`,
    ),
    h(
      "ul",
      { className: "filters" },
      renderFilterLink("all", filter, "All"),
      renderFilterLink("active", filter, "Active"),
      renderFilterLink("completed", filter, "Completed"),
    ),
  ]

  if (completedCount > 0) {
    children.push(h("button", { className: "clear-completed" }, "Clear completed"))
  }

  return h("footer", { className: "footer" }, children)
}

const renderView = (todos: ReadonlyArray<Todo>, filter: Filter): VNode => {
  const activeCount = todos.filter((t) => !t.completed).length
  const completedCount = todos.length - activeCount

  const visible = todos.filter((t) => {
    if (filter === "active") return !t.completed
    if (filter === "completed") return t.completed
    return true
  })

  return h(
    "div",
    { className: "todomvc-wrapper" },
    h(
      "section",
      { className: "todomvc" },
      h(
        "header",
        { className: "header" },
        h("h1", null, "todos"),
        h(
          "form",
          { className: "new-todo-form" },
          h("input", {
            className: "new-todo",
            type: "text",
            placeholder: "What needs to be done?",
            autoFocus: true,
          }),
        ),
      ),
      renderMain(todos, visible),
      renderFooter(todos, filter, activeCount, completedCount),
    ),
    h(
      "footer",
      { className: "info" },
      h("p", null, "Double-click to edit a todo"),
      h(
        "p",
        null,
        "Built with ",
        h("a", { href: "https://github.com/joshburgess/effect-cycle" }, "effect-cycle"),
      ),
    ),
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = Effect.gen(function* () {
  const dom = yield* DOMSource
  const sink = yield* DOMSink

  // State
  const todos = yield* Ref.make<ReadonlyArray<Todo>>([])
  const filter = yield* Ref.make<Filter>("all")
  const nextId = yield* Ref.make(1)

  // Action bus
  const actions = yield* Queue.unbounded<Action>()

  const offer = (action: Action) => Queue.unsafeOffer(actions, action)

  // Event delegation on the root element.
  // Native listeners push typed Actions into the Queue. This works with
  // dynamically rendered DOM because we listen on the persistent root, not
  // on individual todo elements.
  const root = yield* dom.element

  yield* Effect.sync(() => {
    root.addEventListener("submit", (e) => {
      if (!(e.target as Element).matches(".new-todo-form")) return
      e.preventDefault()
      const input = (e.target as HTMLFormElement).querySelector(".new-todo") as HTMLInputElement
      const text = input.value.trim()
      if (text.length > 0) {
        input.value = ""
        offer({ type: "add", text })
      }
    })

    root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement

      if (target.closest(".destroy")) {
        const id = parseTodoId(target)
        if (id !== undefined) offer({ type: "destroy", id })
        return
      }

      if (target.matches(".clear-completed")) {
        offer({ type: "clearCompleted" })
        return
      }

      // Filter links
      if (target.matches(".filter-all")) {
        e.preventDefault()
        offer({ type: "setFilter", filter: "all" })
      } else if (target.matches(".filter-active")) {
        e.preventDefault()
        offer({ type: "setFilter", filter: "active" })
      } else if (target.matches(".filter-completed")) {
        e.preventDefault()
        offer({ type: "setFilter", filter: "completed" })
      }
    })

    root.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement

      if (target.matches(".toggle-all")) {
        offer({ type: "toggleAll", completed: target.checked })
        return
      }

      if (target.matches(".toggle")) {
        const id = parseTodoId(target)
        if (id !== undefined) offer({ type: "toggle", id })
      }
    })
  })

  // Render pipeline: initial tick + action stream -> state -> VNode tree
  const vdom$: Stream.Stream<VNode> = Stream.concat(
    Stream.make(undefined as undefined),
    Stream.fromQueue(actions).pipe(
      Stream.tap((action) => applyAction(action, todos, filter, nextId)),
    ),
  ).pipe(
    Stream.mapEffect(() => Effect.all({ todos: Ref.get(todos), filter: Ref.get(filter) })),
    Stream.map(({ todos, filter }) => renderView(todos, filter)),
  )

  // Start the render loop. sink.render forks internally, so we use
  // Effect.never to keep the app fiber alive (the forked render fiber
  // is a child that would be interrupted if the parent exits).
  yield* sink.render(vdom$)
  yield* Effect.never
})

export default app
