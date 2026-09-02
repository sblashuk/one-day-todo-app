import { AuthScreen } from './components/AuthScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { SessionErrorScreen } from './components/SessionErrorScreen'
import { TodoScreen } from './components/TodoScreen'
import { useSession } from './hooks/useSession'

export default function App() {
  const { loading, user, error, refreshSession } = useSession()

  if (loading) return <LoadingScreen />
  if (error && !user) return <SessionErrorScreen error={error} onRetry={refreshSession} />
  if (!user) return <AuthScreen onAuthenticated={refreshSession} />
  return <TodoScreen user={user} onSignedOut={refreshSession} />
}
