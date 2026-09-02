import { useState } from 'react'

import type { Todo } from '../types/todo'

type TodoListProps = {
  todos: Todo[]
  initialLoading: boolean
  pending: string | null
  onToggle: (todo: Todo) => void
  onRemove: (id: number) => void
}

export function TodoList({ todos, initialLoading, pending, onToggle, onRemove }: TodoListProps) {
  const activeTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos.filter((todo) => todo.completed)

  return (
    <div className="mt-8" aria-busy={initialLoading}>
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
          {activeTodos.length > 0 && (
            <TodoRows
              todos={activeTodos}
              label="Active todos"
              pending={pending}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          )}
          {activeTodos.length === 0 && (
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
            />
          )}
        </>
      )}
    </div>
  )
}

function CompletedTodos({ todos, pending, onToggle, onRemove }: Omit<TodoListProps, 'initialLoading'>) {
  const [expanded, setExpanded] = useState(false)
  const regionId = 'completed-todos-region'
  const toggleId = 'completed-todos-toggle'

  return (
    <section className="completed-section">
      <button
        className="completed-toggle"
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
            onToggle={onToggle}
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
}: Omit<TodoListProps, 'initialLoading'> & { label: string }) {
  return (
    <ul className="list-card" aria-label={label}>
      {todos.map((todo) => {
        const itemPending = pending === `toggle-${todo.id}` || pending === `delete-${todo.id}`
        return (
          <li className="todo-row" key={todo.id}>
            <label className="check-wrap">
              <input
                type="checkbox"
                checked={todo.completed}
                disabled={itemPending}
                onChange={() => onToggle(todo)}
                aria-label={`Mark ${todo.title} ${todo.completed ? 'active' : 'completed'}`}
              />
              <span className="custom-check" aria-hidden="true">
                ✓
              </span>
            </label>
            <span
              className={`min-w-0 flex-1 break-words ${todo.completed ? 'todo-complete' : ''}`}
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
