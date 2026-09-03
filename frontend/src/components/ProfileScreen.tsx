import { useCallback, useEffect, useState } from 'react'

import * as api from '../api'
import type { Completion, User } from '../api'
import { createActivityWindow } from '../utils/activityCalendar'
import { AccountMenu } from './AccountMenu'
import { ActivityCalendar } from './ActivityCalendar'

type ProfileScreenProps = {
  user: User
  onNavigate: (path: string) => void
  onSignedOut: () => Promise<void>
}

export function ProfileScreen({ user, onNavigate, onSignedOut }: ProfileScreenProps) {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityWindow] = useState(createActivityWindow)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCompletions(await api.listCompletions(activityWindow.from, activityWindow.to))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load activity.')
    } finally {
      setLoading(false)
    }
  }, [activityWindow])

  useEffect(() => void load(), [load])

  return (
    <main className="app-shell profile-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-dot" aria-hidden="true" /><span>DAYLIST</span></div>
        <AccountMenu user={user} onNavigate={onNavigate} onSignedOut={onSignedOut} />
      </header>
      <section className="profile-page">
        <a aria-label="Back to Today" className="back-link" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/') }}>
          ← Back to Today
        </a>
        <div className="profile-heading">
          <p className="eyebrow">TWELVE WEEKS IN VIEW</p>
          <h1>Your activity</h1>
          <p>{user.email}</p>
        </div>
        <section className="activity-card" aria-labelledby="activity-title" aria-busy={loading}>
          <div className="activity-card-heading">
            <div><p className="eyebrow">COMPLETION HISTORY</p><h2 id="activity-title">Work, remembered.</h2></div>
            <p>Every finished todo leaves a quiet mark.</p>
          </div>
          {loading ? (
            <div className="profile-state" role="status"><span className="loading-mark" aria-hidden="true" />Loading your activity…</div>
          ) : error ? (
            <div className="profile-state" role="alert"><span>{error}</span><button className="quiet-button" type="button" onClick={() => void load()}>Try again</button></div>
          ) : (
            <>
              <ActivityCalendar completions={completions} activityWindow={activityWindow} />
              {completions.length === 0 && <p className="activity-empty">No completions yet in these twelve weeks. Your next finished todo will appear here.</p>}
            </>
          )}
        </section>
      </section>
    </main>
  )
}
