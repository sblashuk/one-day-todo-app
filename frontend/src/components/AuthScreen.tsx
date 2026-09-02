import { useState } from 'react'
import type { FormEvent } from 'react'

import * as api from '../api'

type AuthMode = 'login' | 'register'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
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
            {isRegister
              ? 'Make a private space for your daily priorities.'
              : 'Sign in to continue your day.'}
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
              {fieldErrors.email && (
                <span id="email-error" className="field-error">
                  {fieldErrors.email}
                </span>
              )}
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
                <span id="password-error" className="field-error">
                  {fieldErrors.password}
                </span>
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
