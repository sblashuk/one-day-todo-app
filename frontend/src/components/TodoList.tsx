import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import type { Priority, Todo, UpdateTodoInput } from '../types/todo'
import { duePresentation, isoToLocalDateTime, localDateTimeToIso } from '../utils/todoDate'

type ValidationState = { key: string; fields: Record<string, string> } | null

type TodoListProps = {
  todos: Todo[]
  initialLoading: boolean
  pending: string | null
  validation: ValidationState
  onToggle: (todo: Todo) => Promise<boolean>
  onUpdate: (id: number, changes: UpdateTodoInput) => Promise<boolean>
  onRemove: (id: number) => void
}

type CompletionCue = { todo: Todo; position: number; departing: boolean }
const departureFallbackMs = 700

export function TodoList({
  todos,
  initialLoading,
  pending,
  validation,
  onToggle,
  onUpdate,
  onRemove,
}: TodoListProps) {
  const activeTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos.filter((todo) => todo.completed)
  const [completionCues, setCompletionCues] = useState<Map<number, CompletionCue>>(new Map())
  const [announcement, setAnnouncement] = useState('')
  const [now, setNow] = useState(() => new Date())
  const departureTimers = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const dueTimer = window.setInterval(() => setNow(new Date()), 30_000)
    const timers = departureTimers.current
    return () => {
      window.clearInterval(dueTimer)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

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
          <div className="empty-mark" aria-hidden="true">✓</div>
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
              now={now}
              pending={pending}
              validation={validation}
              departingIds={departingIds}
              onDepartureEnd={clearCompletionCue}
              onToggle={(todo) => void toggleWithCompletionCue(todo)}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          )}
          {displayedActiveTodos.length === 0 && (
            <div className="all-done-card">
              <span className="all-done-mark" aria-hidden="true">✓</span>
              <div>
                <h2 className="font-display text-2xl font-semibold">All done for today.</h2>
                <p className="mt-1 text-sm text-ink-muted">Your finished list is tucked below.</p>
              </div>
            </div>
          )}
          {completedTodos.length > 0 && (
            <CompletedTodos
              todos={completedTodos}
              now={now}
              pending={pending}
              validation={validation}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onRemove={onRemove}
              arrival={departingIds.size > 0}
            />
          )}
        </>
      )}
    </div>
  )
}

type RowActions = Pick<TodoListProps, 'pending' | 'validation' | 'onUpdate' | 'onRemove'> & {
  now: Date
  onToggle: (todo: Todo) => void
}

function CompletedTodos({
  todos,
  now,
  pending,
  validation,
  onToggle,
  onUpdate,
  onRemove,
  arrival,
}: RowActions & { todos: Todo[]; arrival: boolean; onToggle: (todo: Todo) => Promise<boolean> }) {
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
        <span className="completed-chevron" aria-hidden="true">›</span>
        <span>Completed</span>
        <span className="completed-count">({todos.length})</span>
      </button>
      {expanded && (
        <div className="completed-region" id={regionId} role="region" aria-labelledby={toggleId}>
          <TodoRows
            todos={todos}
            label="Completed todos"
            now={now}
            pending={pending}
            validation={validation}
            onToggle={(todo) => void onToggle(todo)}
            onUpdate={onUpdate}
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
  now,
  pending,
  validation,
  onToggle,
  onUpdate,
  onRemove,
  departingIds = new Set(),
  onDepartureEnd,
}: RowActions & {
  todos: Todo[]
  label: string
  departingIds?: ReadonlySet<number>
  onDepartureEnd?: (id: number) => void
}) {
  return (
    <ul className="list-card" aria-label={label}>
      {todos.map((todo) => (
        <TodoRow
          key={todo.id}
          todo={todo}
          now={now}
          pending={pending}
          validation={validation}
          departing={departingIds.has(todo.id)}
          onDepartureEnd={onDepartureEnd}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}

function TodoRow({
  todo,
  now,
  pending,
  validation,
  departing,
  onDepartureEnd,
  onToggle,
  onUpdate,
  onRemove,
}: RowActions & { todo: Todo; departing: boolean; onDepartureEnd?: (id: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(todo.title)
  const [dueAt, setDueAt] = useState(isoToLocalDateTime(todo.dueAt))
  const [priority, setPriority] = useState<Priority | ''>(todo.priority ?? '')
  const [titleError, setTitleError] = useState('')
  const editKey = `edit-${todo.id}`
  const fieldErrors = validation?.key === editKey ? validation.fields : {}
  const itemPending =
    departing ||
    pending === `toggle-${todo.id}` ||
    pending === `delete-${todo.id}` ||
    pending === editKey
  const due = todo.dueAt ? duePresentation(todo.dueAt, now, todo.completed) : null

  function beginEditing() {
    setTitle(todo.title)
    setDueAt(isoToLocalDateTime(todo.dueAt))
    setPriority(todo.priority ?? '')
    setTitleError('')
    setEditing(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200) {
      setTitleError('Title must be 1–200 characters.')
      return
    }
    setTitleError('')
    const changed = await onUpdate(todo.id, {
      title: trimmed,
      dueAt: localDateTimeToIso(dueAt),
      priority: priority || null,
    })
    if (changed) setEditing(false)
  }

  return (
    <li
      className={`todo-row ${todo.completed ? 'todo-row--completed' : ''} ${departing ? 'todo-row--departing' : ''}`}
      aria-hidden={departing || undefined}
      onAnimationEnd={(event) => {
        if (departing && event.target === event.currentTarget) onDepartureEnd?.(todo.id)
      }}
    >
      <div className="todo-row-main">
        <label className="check-wrap">
          <input
            type="checkbox"
            checked={todo.completed || departing}
            disabled={itemPending || editing}
            onChange={() => onToggle(todo)}
            aria-label={`Mark ${todo.title} ${todo.completed ? 'active' : 'completed'}`}
          />
          <span className="custom-check" aria-hidden="true">✓</span>
        </label>
        <div className="todo-content">
          <span className={`break-words ${todo.completed || departing ? 'todo-complete' : ''}`}>
            {todo.title}
          </span>
          {(todo.priority || due) && (
            <div className={`todo-metadata ${todo.completed ? 'todo-metadata--completed' : ''}`}>
              {todo.priority && (
                <span className={`priority-badge priority-badge--${todo.priority}`}>
                  {todo.priority[0].toUpperCase() + todo.priority.slice(1)} priority
                </span>
              )}
              {due && (
                <time className={`due-label due-label--${due.status}`} dateTime={todo.dueAt ?? ''}>
                  {due.label}
                </time>
              )}
            </div>
          )}
        </div>
        <button
          className="edit-button"
          type="button"
          disabled={itemPending || editing}
          onClick={beginEditing}
          aria-label={`Edit ${todo.title}`}
        >
          Edit
        </button>
        <button
          className="remove-button"
          type="button"
          disabled={itemPending || editing}
          onClick={() => onRemove(todo.id)}
          aria-label={`Remove ${todo.title}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {editing && (
        <form className="todo-edit-form" onSubmit={(event) => void save(event)} noValidate>
          <label className="compact-field">
            <span>Title</span>
            <input
              className="detail-input"
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value)
                if (titleError) setTitleError('')
              }}
              aria-label={`Edit title for ${todo.title}`}
              aria-invalid={Boolean(titleError || fieldErrors.title)}
            />
            {(titleError || fieldErrors.title) && (
              <span className="field-error">{titleError || fieldErrors.title}</span>
            )}
          </label>
          <label className="compact-field">
            <span>Due date and time</span>
            <input
              className="detail-input"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              aria-label={`Edit due date and time for ${todo.title}`}
              aria-invalid={Boolean(fieldErrors.dueAt)}
            />
            {fieldErrors.dueAt && <span className="field-error">{fieldErrors.dueAt}</span>}
          </label>
          <label className="compact-field">
            <span>Priority</span>
            <select
              className="detail-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority | '')}
              aria-label={`Edit priority for ${todo.title}`}
              aria-invalid={Boolean(fieldErrors.priority)}
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {fieldErrors.priority && <span className="field-error">{fieldErrors.priority}</span>}
          </label>
          <div className="todo-edit-actions">
            <button
              className="quiet-button"
              type="button"
              disabled={itemPending}
              onClick={() => setEditing(false)}
              aria-label={`Cancel editing ${todo.title}`}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={itemPending || !title.trim()}
              aria-label={`Save ${todo.title}`}
            >
              {pending === editKey ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}
