import { useState } from 'react'
import type { FormEvent } from 'react'

type AddTodoFormProps = {
  pending: boolean
  onAdd: (title: string) => Promise<boolean>
}

export function AddTodoForm({ pending, onAdd }: AddTodoFormProps) {
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200) {
      setTitleError('Title must be 1–200 characters.')
      return
    }
    setTitleError('')
    if (await onAdd(trimmed)) setTitle('')
  }

  return (
    <form className="add-card" onSubmit={submit}>
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
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? 'todo-title-error' : undefined}
        />
        {titleError && (
          <p id="todo-title-error" className="field-error mt-2">
            {titleError}
          </p>
        )}
      </div>
      <button className="add-button" type="submit" disabled={pending || !title.trim()}>
        <span aria-hidden="true">＋</span>
        <span>{pending ? 'Adding…' : 'Add todo'}</span>
      </button>
    </form>
  )
}
