import { useCallback, useEffect, useState } from 'react'

import * as api from '../api'
import type { Todo } from '../types/todo'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const loadTodos = useCallback(async () => {
    try {
      setTodos(await api.listTodos())
      setError('')
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your todos.')
      return false
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
    let changed = false
    try {
      await action()
      changed = await loadTodos()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.')
    } finally {
      setPending(null)
    }
    return changed
  }

  function addTodo(title: string) {
    return mutate('add', () => api.addTodo(title))
  }

  function toggleTodo(todo: Todo) {
    return mutate(`toggle-${todo.id}`, () => api.updateTodo(todo.id, !todo.completed))
  }

  function removeTodo(id: number) {
    return mutate(`delete-${id}`, () => api.removeTodo(id))
  }

  return {
    todos,
    initialLoading,
    error,
    pending,
    loadTodos,
    addTodo,
    toggleTodo,
    removeTodo,
  }
}
