import { useCallback, useEffect, useState } from 'react'

import * as api from '../api'
import type { User } from '../types/auth'

export function useSession() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  const refreshSession = useCallback(async () => {
    try {
      const current = await api.getSession()
      setUser(current.user)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open the app.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  return { loading, user, error, refreshSession }
}
