import { useCallback, useEffect, useState } from 'react'

import * as api from '../api'
import type { CreateTodoInput, Todo, UpdateTodoInput } from '../types/todo'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [validation, setValidation] = useState<{
    key: string
    fields: Record<string, string>
  } | null>(null)

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
    setValidation(null)
    let changed = false
    try {
      await action()
      changed = await loadTodos()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.')
      if (caught instanceof api.ApiError && caught.fields) {
        setValidation({ key, fields: caught.fields })
      }
    } finally {
      setPending(null)
    }
    return changed
  }

  function addTodo(input: CreateTodoInput) {
    return mutate('add', () => api.addTodo(input))
  }

  function toggleTodo(todo: Todo) {
    return mutate(`toggle-${todo.id}`, () =>
      api.updateTodo(todo.id, { completed: !todo.completed }),
    )
  }

  function updateTodo(id: number, changes: UpdateTodoInput) {
    return mutate(`edit-${id}`, () => api.updateTodo(id, changes))
  }

  function removeTodo(id: number) {
    return mutate(`delete-${id}`, () => api.removeTodo(id))
  }

  return {
    todos,
    initialLoading,
    error,
    pending,
    validation,
    loadTodos,
    addTodo,
    toggleTodo,
    updateTodo,
    removeTodo,
  }
}
