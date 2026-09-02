import { AuthScreen } from './components/AuthScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { SessionErrorScreen } from './components/SessionErrorScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { TodoScreen } from './components/TodoScreen'
import { useSession } from './hooks/useSession'

export default function App() {
  const { loading, user, error, refreshSession } = useSession()
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  function navigate(nextPath: string) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }

  if (loading) return <LoadingScreen />
  if (error && !user) return <SessionErrorScreen error={error} onRetry={refreshSession} />
  if (!user) return <AuthScreen onAuthenticated={refreshSession} />
  if (path === '/profile') {
    return <ProfileScreen user={user} onNavigate={navigate} onSignedOut={refreshSession} />
  }
  return <TodoScreen user={user} onNavigate={navigate} onSignedOut={refreshSession} />
}
import { useEffect, useState } from 'react'
