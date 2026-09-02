import type { Session, User } from '../types/auth'
import { request, setCsrfToken } from './client'

export async function getSession(): Promise<Session> {
  const result = await request<Session>('/api/auth/session')
  setCsrfToken(result.csrfToken)
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
