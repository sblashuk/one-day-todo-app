import type { CreateTodoInput, Todo, UpdateTodoInput } from '../types/todo'
import { request } from './client'

export async function listTodos(): Promise<Todo[]> {
  const result = await request<{ todos: Todo[] }>('/api/todos')
  return result.todos
}

export async function addTodo(input: CreateTodoInput): Promise<Todo> {
  const result = await request<{ todo: Todo }>('/api/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.todo
}

export async function updateTodo(id: number, changes: UpdateTodoInput): Promise<Todo> {
  const result = await request<{ todo: Todo }>(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
  return result.todo
}

export async function removeTodo(id: number): Promise<void> {
  await request<void>(`/api/todos/${id}`, { method: 'DELETE' })
}
