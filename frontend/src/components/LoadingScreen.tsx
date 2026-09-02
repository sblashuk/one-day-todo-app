export function LoadingScreen() {
  return (
    <main className="app-shell grid place-items-center" aria-live="polite">
      <div className="text-center">
        <span className="loading-mark" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold tracking-wide text-ink-muted">Opening your day…</p>
      </div>
    </main>
  )
}
