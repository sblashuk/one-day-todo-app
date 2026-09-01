export type User = {
  id: number
  email: string
}

export type Todo = {
  id: number
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export type Session = {
  user: User | null
  csrfToken: string
}

type ErrorPayload = {
  error?: {
    code?: string
    message?: string
    fields?: Record<string, string>
  }
}

export class ApiError extends Error {
  code: string
  fields?: Record<string, string>

  constructor(message: string, code = 'request_failed', fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.fields = fields
  }
}

let csrfToken = ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRFToken', csrfToken)

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 'network_error')
  }

  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const error = (payload as ErrorPayload | undefined)?.error
    throw new ApiError(
      error?.message ?? 'Something went wrong. Please try again.',
      error?.code,
      error?.fields,
    )
  }
  return payload as T
}

export async function getSession(): Promise<Session> {
  const result = await request<Session>('/api/auth/session')
  csrfToken = result.csrfToken
  return result
}

export async function register(email: string, password: string): Promise<User> {
  const result = await request<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return result.user
}

export async function login(email: string, password: string): Promise<User> {
  const result = await request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return result.user
}

export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' })
}

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

