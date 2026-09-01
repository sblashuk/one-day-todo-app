import { FormEvent, useCallback, useEffect, useState } from 'react'

import * as api from './api'
import type { Todo, User } from './api'
import './index.css'

type AuthMode = 'login' | 'register'

function LoadingScreen() {
  return (
    <main className="app-shell grid place-items-center" aria-live="polite">
      <div className="text-center">
        <span className="loading-mark" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold tracking-wide text-ink-muted">Opening your day…</p>
      </div>
    </main>
  )
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const isRegister = mode === 'register'

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setFieldErrors({})
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!email.trim() || !email.includes('@')) nextErrors.email = 'Enter a valid email address.'
    if (password.length < 8 || password.length > 128) {
      nextErrors.password = 'Password must be 8–128 characters.'
    }
    setFieldErrors(nextErrors)
    setError('')
    if (Object.keys(nextErrors).length) return

    setPending(true)
    try {
      if (isRegister) await api.register(email, password)
      else await api.login(email, password)
      await onAuthenticated()
    } catch (caught) {
      if (caught instanceof api.ApiError) {
        setError(caught.message)
        setFieldErrors(caught.fields ?? {})
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="app-shell auth-layout">
      <section className="brand-panel" aria-label="Daylist introduction">
        <div className="brand-lockup">
          <span className="brand-dot" aria-hidden="true" />
          <span>DAYLIST</span>
        </div>
        <div className="max-w-lg">
          <p className="eyebrow">ONE DAY AT A TIME</p>
          <h1 className="display-title mt-5">A quieter place for what matters today.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
            Capture the work, finish what counts, and let the rest wait. Your list stays simple and
            yours.
          </p>
        </div>
        <p className="text-sm text-ink-muted">Private by default · Built for focus</p>
      </section>

      <section className="auth-card-wrap">
        <div className="auth-card">
          <p className="eyebrow">{isRegister ? 'START FRESH' : 'YOUR LIST AWAITS'}</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-ink">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {isRegister ? 'Make a private space for your daily priorities.' : 'Sign in to continue your day.'}
          </p>

          {error && (
            <div className="error-banner mt-6" role="alert">
              {error}
            </div>
          )}

          <form className="mt-7 space-y-5" onSubmit={submit} noValidate>
            <div className="field-label">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="text-field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && <span id="email-error" className="field-error">{fieldErrors.email}</span>}
            </div>
            <div className="field-label">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="text-field"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              {fieldErrors.password && (
                <span id="password-error" className="field-error">{fieldErrors.password}</span>
              )}
            </div>
            <button className="primary-button w-full" type="submit" disabled={pending}>
              {pending ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
            {isRegister ? 'Already have an account?' : 'New to Daylist?'}{' '}
            <button
              type="button"
              className="font-semibold text-forest underline-offset-4 hover:underline"
              onClick={() => changeMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function TodoScreen({ user, onSignedOut }: { user: User; onSignedOut: () => Promise<void> }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const loadTodos = useCallback(async () => {
    try {
      setTodos(await api.listTodos())
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your todos.')
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTodos()
  }, [loadTodos])

  async function mutate(key: string, action: () => Promise<unknown>) {
    setPending(key)
    setError('')
    try {
      await action()
      await loadTodos()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.')
    } finally {
      setPending(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > 200) {
      setTitleError('Title must be 1–200 characters.')
      return
    }
    setTitleError('')
    await mutate('add', async () => {
      await api.addTodo(trimmed)
      setTitle('')
    })
  }

  async function signOut() {
    setPending('logout')
    setError('')
    try {
      await api.logout()
      await onSignedOut()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign out.')
      setPending(null)
    }
  }

  const activeCount = todos.filter((todo) => !todo.completed).length
  const completedCount = todos.length - activeCount

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
            disabled={pending === 'logout'}
          >
            {pending === 'logout' ? 'Signing out…' : 'Sign out'}
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

        <form className="add-card" onSubmit={submit}>
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="new-todo">New todo</label>
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
            {titleError && <p id="todo-title-error" className="field-error mt-2">{titleError}</p>}
          </div>
          <button className="add-button" type="submit" disabled={pending === 'add' || !title.trim()}>
            <span aria-hidden="true">＋</span>
            <span>{pending === 'add' ? 'Adding…' : 'Add todo'}</span>
          </button>
        </form>

        {error && (
          <div className="error-banner mt-5 flex items-center justify-between gap-4" role="alert">
            <span>{error}</span>
            <button className="font-bold underline" type="button" onClick={() => void loadTodos()}>
              Retry
            </button>
          </div>
        )}

        <div className="mt-8" aria-busy={initialLoading}>
          {initialLoading ? (
            <div className="list-card grid place-items-center py-16" aria-live="polite">
              <span className="loading-mark" aria-hidden="true" />
              <p className="mt-4 text-sm text-ink-muted">Gathering your list…</p>
            </div>
          ) : todos.length === 0 ? (
            <div className="empty-card">
              <div className="empty-mark" aria-hidden="true">✓</div>
              <h2 className="mt-5 font-display text-3xl font-semibold">Your day is wide open.</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">Add one meaningful thing above when you’re ready.</p>
            </div>
          ) : (
            <ul className="list-card" aria-label="Todos">
              {todos.map((todo) => {
                const itemPending = pending === `toggle-${todo.id}` || pending === `delete-${todo.id}`
                return (
                  <li className="todo-row" key={todo.id}>
                    <label className="check-wrap">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        disabled={itemPending}
                        onChange={() =>
                          void mutate(`toggle-${todo.id}`, () => api.updateTodo(todo.id, !todo.completed))
                        }
                        aria-label={`Mark ${todo.title} ${todo.completed ? 'active' : 'completed'}`}
                      />
                      <span className="custom-check" aria-hidden="true">✓</span>
                    </label>
                    <span className={`min-w-0 flex-1 break-words ${todo.completed ? 'todo-complete' : ''}`}>
                      {todo.title}
                    </span>
                    <button
                      className="remove-button"
                      type="button"
                      disabled={itemPending}
                      onClick={() => void mutate(`delete-${todo.id}`, () => api.removeTodo(todo.id))}
                      aria-label={`Remove ${todo.title}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  async function refreshSession() {
    try {
      const current = await api.getSession()
      setUser(current.user)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open the app.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  if (loading) return <LoadingScreen />
  if (error && !user) {
    return (
      <main className="app-shell grid place-items-center p-6">
        <div className="auth-card max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold">We couldn’t open Daylist.</h1>
          <p className="mt-3 text-ink-muted" role="alert">{error}</p>
          <button className="primary-button mt-6" type="button" onClick={() => void refreshSession()}>
            Try again
          </button>
        </div>
      </main>
    )
  }
  if (!user) return <AuthScreen onAuthenticated={refreshSession} />
  return <TodoScreen user={user} onSignedOut={refreshSession} />
}
