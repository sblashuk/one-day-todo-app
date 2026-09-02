import { useState } from 'react'

import * as api from '../api'
import { useTodos } from '../hooks/useTodos'
import type { User } from '../types/auth'
import { AddTodoForm } from './AddTodoForm'
import { TodoList } from './TodoList'

type TodoScreenProps = {
  user: User
  onSignedOut: () => Promise<void>
}

export function TodoScreen({ user, onSignedOut }: TodoScreenProps) {
  const {
    todos,
    initialLoading,
    error: todoError,
    pending,
    loadTodos,
    addTodo,
    toggleTodo,
    removeTodo,
  } = useTodos()
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  async function signOut() {
    setLogoutPending(true)
    setLogoutError('')
    try {
      await api.logout()
      await onSignedOut()
    } catch (caught) {
      setLogoutError(caught instanceof Error ? caught.message : 'Could not sign out.')
      setLogoutPending(false)
    }
  }

  function retry() {
    setLogoutError('')
    void loadTodos()
  }

  const activeCount = todos.filter((todo) => !todo.completed).length
  const completedCount = todos.length - activeCount
  const error = logoutError || todoError

  return (
    <main className="app-shell todo-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-dot" aria-hidden="true" />
          <span>DAYLIST</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-muted sm:inline">{user.email}</span>
          <button
            className="quiet-button"
            type="button"
            onClick={() => void signOut()}
            disabled={logoutPending}
          >
            {logoutPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <section className="todo-page">
        <div className="todo-heading">
          <div>
            <p className="eyebrow">ONE CLEAR LIST</p>
            <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
              Today
            </h1>
          </div>
          <div className="count-pill" aria-live="polite">
            <span>{activeCount} active</span>
            <span aria-hidden="true">·</span>
            <span>{completedCount} completed</span>
          </div>
        </div>

        <AddTodoForm
          pending={pending === 'add'}
          onAdd={(title) => {
            setLogoutError('')
            return addTodo(title)
          }}
        />

        {error && (
          <div className="error-banner mt-5 flex items-center justify-between gap-4" role="alert">
            <span>{error}</span>
            <button className="font-bold underline" type="button" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        <TodoList
          todos={todos}
          initialLoading={initialLoading}
          pending={pending}
          onToggle={(todo) => {
            setLogoutError('')
            return toggleTodo(todo)
          }}
          onRemove={(id) => {
            setLogoutError('')
            void removeTodo(id)
          }}
        />
      </section>
    </main>
  )
}
