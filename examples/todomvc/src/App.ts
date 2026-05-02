/**
 * TodoMVC: effect-cycle showcase
 *
 * Demonstrates the full effect-cycle pattern in a single component:
 *   - DOMSource.element for event delegation on dynamic DOM
 *   - Effect Queue as an action bus (Elm-style)
 *   - Ref-based state management
 *   - Stream-driven rendering with morphdom patching
 *
 * Architecture:
 *   Native event listeners on the root element push typed Actions into a Queue.
 *   A single Stream drains the Queue, applies each Action to Ref state, reads
 *   the updated state, and maps it to an HTML string for the DOM driver to render.
 */
import { Effect, Queue, Ref, Stream } from "effect"
import { DOMSink, DOMSource } from "effect-cycle-dom"

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

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

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
// View
// ---------------------------------------------------------------------------

const renderView = (todos: ReadonlyArray<Todo>, filter: Filter): string => {
  const activeCount = todos.filter((t) => !t.completed).length
  const completedCount = todos.length - activeCount
  const allCompleted = todos.length > 0 && activeCount === 0

  const visible = todos.filter((t) => {
    if (filter === "active") return !t.completed
    if (filter === "completed") return t.completed
    return true
  })

  const todoItems = visible
    .map(
      (t) => `
      <li class="todo-item${t.completed ? " completed" : ""}" data-id="${t.id}">
        <input class="toggle" type="checkbox" ${t.completed ? "checked" : ""} />
        <label>${escapeHtml(t.text)}</label>
        <button class="destroy"></button>
      </li>`,
    )
    .join("")

  const mainSection =
    todos.length > 0
      ? `<section class="main">
          <label class="toggle-all-label">
            <input class="toggle-all" type="checkbox" ${allCompleted ? "checked" : ""} />
            <span>Mark all as complete</span>
          </label>
          <ul class="todo-list">${todoItems}</ul>
        </section>`
      : ""

  const footerSection =
    todos.length > 0
      ? `<footer class="footer">
          <span class="todo-count">
            <strong>${activeCount}</strong> ${activeCount === 1 ? "item" : "items"} left
          </span>
          <ul class="filters">
            <li><a class="filter-all${filter === "all" ? " selected" : ""}" href="#">All</a></li>
            <li><a class="filter-active${filter === "active" ? " selected" : ""}" href="#">Active</a></li>
            <li><a class="filter-completed${filter === "completed" ? " selected" : ""}" href="#">Completed</a></li>
          </ul>
          ${completedCount > 0 ? '<button class="clear-completed">Clear completed</button>' : ""}
        </footer>`
      : ""

  return `<div class="todomvc-wrapper">
    <section class="todomvc">
      <header class="header">
        <h1>todos</h1>
        <form class="new-todo-form">
          <input class="new-todo" type="text" placeholder="What needs to be done?" autofocus />
        </form>
      </header>
      ${mainSection}
      ${footerSection}
    </section>
    <footer class="info">
      <p>Double-click to edit a todo</p>
      <p>Built with <a href="https://github.com/joshburgess/effect-cycle">effect-cycle</a></p>
    </footer>
  </div>`
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

  // Render pipeline: initial tick + action stream -> state -> HTML
  const vdom$: Stream.Stream<string> = Stream.concat(
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
