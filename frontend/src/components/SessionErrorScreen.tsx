type SessionErrorScreenProps = {
  error: string
  onRetry: () => Promise<void>
}

export function SessionErrorScreen({ error, onRetry }: SessionErrorScreenProps) {
  return (
    <main className="app-shell grid place-items-center p-6">
      <div className="auth-card max-w-md text-center">
        <h1 className="font-display text-3xl font-semibold">We couldn’t open Daylist.</h1>
        <p className="mt-3 text-ink-muted" role="alert">
          {error}
        </p>
        <button className="primary-button mt-6" type="button" onClick={() => void onRetry()}>
          Try again
        </button>
      </div>
    </main>
  )
}
