import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateTodoInput, Priority } from '../types/todo'
import { localDateTimeToIso } from '../utils/todoDate'

type AddTodoFormProps = {
  pending: boolean
  fieldErrors?: Record<string, string>
  onAdd: (input: CreateTodoInput) => Promise<boolean>
}

export function AddTodoForm({ pending, fieldErrors = {}, onAdd }: AddTodoFormProps) {
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [titleError, setTitleError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200) {
      setTitleError('Title must be 1–200 characters.')
      return
    }
    setTitleError('')
    const added = await onAdd({
      title: trimmed,
      dueAt: localDateTimeToIso(dueAt),
      priority: priority || null,
    })
    if (added) {
      setTitle('')
      setDueAt('')
      setPriority('')
    }
  }

  return (
    <form className="add-card" onSubmit={submit}>
      <div className="add-fields">
        <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="new-todo">
          New todo
        </label>
        <input
          id="new-todo"
          className="todo-input"
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value)
            if (titleError) setTitleError('')
          }}
          placeholder="What needs your attention?"
          aria-invalid={Boolean(titleError || fieldErrors.title)}
          aria-describedby={titleError || fieldErrors.title ? 'todo-title-error' : undefined}
        />
        {(titleError || fieldErrors.title) && (
          <p id="todo-title-error" className="field-error mt-2">
            {titleError || fieldErrors.title}
          </p>
        )}
        </div>
        <div className="add-details">
          <label className="compact-field" htmlFor="new-todo-due-at">
            <span>Due date and time</span>
            <input
              id="new-todo-due-at"
              className="detail-input"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              aria-invalid={Boolean(fieldErrors.dueAt)}
            />
            {fieldErrors.dueAt && <span className="field-error">{fieldErrors.dueAt}</span>}
          </label>
          <label className="compact-field" htmlFor="new-todo-priority">
            <span>Priority</span>
            <select
              id="new-todo-priority"
              className="detail-input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority | '')}
              aria-invalid={Boolean(fieldErrors.priority)}
            >
              <option value="">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {fieldErrors.priority && (
              <span className="field-error">{fieldErrors.priority}</span>
            )}
          </label>
        </div>
      </div>
      <button className="add-button" type="submit" disabled={pending || !title.trim()}>
        <span aria-hidden="true">＋</span>
        <span>{pending ? 'Adding…' : 'Add todo'}</span>
      </button>
    </form>
  )
}
