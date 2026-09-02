import { useEffect, useRef, useState } from 'react'

import type { Todo } from '../types/todo'

type TodoListProps = {
  todos: Todo[]
  initialLoading: boolean
  pending: string | null
  onToggle: (todo: Todo) => Promise<boolean>
  onRemove: (id: number) => void
}

type CompletionCue = {
  todo: Todo
  position: number
  departing: boolean
}

const departureFallbackMs = 700

export function TodoList({ todos, initialLoading, pending, onToggle, onRemove }: TodoListProps) {
  const activeTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos.filter((todo) => todo.completed)
  const [completionCues, setCompletionCues] = useState<Map<number, CompletionCue>>(new Map())
  const [announcement, setAnnouncement] = useState('')
  const departureTimers = useRef<Map<number, number>>(new Map())

  useEffect(
    () => () => {
      departureTimers.current.forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  const displayedActiveTodos = [...activeTodos]
  const sortedCues = [...completionCues.values()].sort((left, right) => left.position - right.position)
  sortedCues.forEach((cue) => {
    if (!displayedActiveTodos.some((todo) => todo.id === cue.todo.id)) {
      displayedActiveTodos.splice(Math.min(cue.position, displayedActiveTodos.length), 0, cue.todo)
    }
  })
  const departingIds = new Set(
    sortedCues.filter((cue) => cue.departing).map((cue) => cue.todo.id),
  )

  function clearCompletionCue(id: number) {
    const timer = departureTimers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      departureTimers.current.delete(id)
    }
    setCompletionCues((current) => {
      const next = new Map(current)
      next.delete(id)
      return next
    })
  }

  async function toggleWithCompletionCue(todo: Todo) {
    if (todo.completed) {
      await onToggle(todo)
      return
    }

    const position = activeTodos.findIndex((activeTodo) => activeTodo.id === todo.id)
    setAnnouncement('')
    setCompletionCues((current) => {
      const next = new Map(current)
      next.set(todo.id, { todo, position: Math.max(position, 0), departing: false })
      return next
    })

    const changed = await onToggle(todo)
    if (!changed) {
      clearCompletionCue(todo.id)
      return
    }

    setCompletionCues((current) => {
      const next = new Map(current)
      const cue = next.get(todo.id)
      if (cue) next.set(todo.id, { ...cue, departing: true })
      return next
    })
    setAnnouncement(`${todo.title} moved to Completed.`)

    const timer = window.setTimeout(() => clearCompletionCue(todo.id), departureFallbackMs)
    departureTimers.current.set(todo.id, timer)
  }

  return (
    <div className="mt-8" aria-busy={initialLoading}>
      {announcement && (
        <p className="sr-only" role="status">
          {announcement}
        </p>
      )}
      {initialLoading ? (
        <div className="list-card grid place-items-center py-16" aria-live="polite">
          <span className="loading-mark" aria-hidden="true" />
          <p className="mt-4 text-sm text-ink-muted">Gathering your list…</p>
        </div>
      ) : todos.length === 0 ? (
        <div className="empty-card">
          <div className="empty-mark" aria-hidden="true">
            ✓
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold">Your day is wide open.</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Add one meaningful thing above when you’re ready.
          </p>
        </div>
      ) : (
        <>
          {displayedActiveTodos.length > 0 && (
            <TodoRows
              todos={displayedActiveTodos}
              label="Active todos"
              pending={pending}
              departingIds={departingIds}
              onDepartureEnd={clearCompletionCue}
              onToggle={(todo) => void toggleWithCompletionCue(todo)}
              onRemove={onRemove}
            />
          )}
          {displayedActiveTodos.length === 0 && (
            <div className="all-done-card">
              <span className="all-done-mark" aria-hidden="true">
                ✓
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold">All done for today.</h2>
                <p className="mt-1 text-sm text-ink-muted">Your finished list is tucked below.</p>
              </div>
            </div>
          )}
          {completedTodos.length > 0 && (
            <CompletedTodos
              todos={completedTodos}
              pending={pending}
              onToggle={onToggle}
              onRemove={onRemove}
              arrival={departingIds.size > 0}
            />
          )}
        </>
      )}
    </div>
  )
}

function CompletedTodos({
  todos,
  pending,
  onToggle,
  onRemove,
  arrival,
}: Omit<TodoListProps, 'initialLoading'> & { arrival: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const regionId = 'completed-todos-region'
  const toggleId = 'completed-todos-toggle'

  return (
    <section className="completed-section">
      <button
        className={`completed-toggle ${arrival ? 'completed-toggle--arrival' : ''}`}
        id={toggleId}
        type="button"
        aria-label={`Completed (${todos.length})`}
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="completed-chevron" aria-hidden="true">
          ›
        </span>
        <span>Completed</span>
        <span className="completed-count">({todos.length})</span>
      </button>
      {expanded && (
        <div
          className="completed-region"
          id={regionId}
          role="region"
          aria-labelledby={toggleId}
        >
          <TodoRows
            todos={todos}
            label="Completed todos"
            pending={pending}
            onToggle={(todo) => void onToggle(todo)}
            onRemove={onRemove}
          />
        </div>
      )}
    </section>
  )
}

function TodoRows({
  todos,
  label,
  pending,
  onToggle,
  onRemove,
  departingIds = new Set(),
  onDepartureEnd,
}: Omit<TodoListProps, 'initialLoading' | 'onToggle'> & {
  label: string
  onToggle: (todo: Todo) => void
  departingIds?: ReadonlySet<number>
  onDepartureEnd?: (id: number) => void
}) {
  return (
    <ul className="list-card" aria-label={label}>
      {todos.map((todo) => {
        const departing = departingIds.has(todo.id)
        const itemPending =
          departing || pending === `toggle-${todo.id}` || pending === `delete-${todo.id}`
        return (
          <li
            className={`todo-row ${departing ? 'todo-row--departing' : ''}`}
            key={todo.id}
            aria-hidden={departing || undefined}
            onAnimationEnd={(event) => {
              if (departing && event.target === event.currentTarget) onDepartureEnd?.(todo.id)
            }}
          >
            <label className="check-wrap">
              <input
                type="checkbox"
                checked={todo.completed || departing}
                disabled={itemPending}
                onChange={() => onToggle(todo)}
                aria-label={`Mark ${todo.title} ${todo.completed ? 'active' : 'completed'}`}
              />
              <span className="custom-check" aria-hidden="true">
                ✓
              </span>
            </label>
            <span
              className={`min-w-0 flex-1 break-words ${todo.completed || departing ? 'todo-complete' : ''}`}
            >
              {todo.title}
            </span>
            <button
              className="remove-button"
              type="button"
              disabled={itemPending}
              onClick={() => onRemove(todo.id)}
              aria-label={`Remove ${todo.title}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
