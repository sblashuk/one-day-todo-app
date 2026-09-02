import type { Todo } from '../types/todo'
import { request } from './client'

export async function listTodos(): Promise<Todo[]> {
  const result = await request<{ todos: Todo[] }>('/api/todos')
  return result.todos
}

export async function addTodo(title: string): Promise<Todo> {
  const result = await request<{ todo: Todo }>('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  return result.todo
}

export async function updateTodo(id: number, completed: boolean): Promise<Todo> {
  const result = await request<{ todo: Todo }>(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  })
  return result.todo
}

export async function removeTodo(id: number): Promise<void> {
  await request<void>(`/api/todos/${id}`, { method: 'DELETE' })
}
