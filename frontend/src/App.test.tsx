import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import App from './App'
import * as api from './api'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    getSession: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    listTodos: vi.fn(),
    addTodo: vi.fn(),
    updateTodo: vi.fn(),
    removeTodo: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

describe('App', () => {
  beforeEach(() => {
    mockedApi.getSession.mockResolvedValue({ user: null, csrfToken: 'token' })
    mockedApi.listTodos.mockResolvedValue([])
  })

  test('shows login and registration choices to an anonymous visitor', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  test('validates registration and opens the signed-in list', async () => {
    const user = userEvent.setup()
    mockedApi.getSession
      .mockResolvedValueOnce({ user: null, csrfToken: 'anonymous-token' })
      .mockResolvedValueOnce({ user: { id: 1, email: 'person@example.com' }, csrfToken: 'user-token' })
    mockedApi.register.mockResolvedValue({ id: 1, email: 'person@example.com' })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Create account' }))
    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Password must be 8–128 characters.')).toBeInTheDocument()
    expect(mockedApi.register).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Password'), 'ened')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(mockedApi.register).toHaveBeenCalledWith('person@example.com', 'shortened')
  })

  test('recovers when initial session loading fails', async () => {
    const user = userEvent.setup()
    mockedApi.getSession
      .mockRejectedValueOnce(new api.ApiError('Server unavailable'))
      .mockResolvedValueOnce({ user: null, csrfToken: 'token' })
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  test('shows an empty state for a signed-in user', async () => {
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    render(<App />)

    expect(await screen.findByText('Your day is wide open.')).toBeInTheDocument()
  })

  test('signs out and returns to the anonymous screen', async () => {
    const user = userEvent.setup()
    mockedApi.getSession
      .mockResolvedValueOnce({
        user: { id: 1, email: 'person@example.com' },
        csrfToken: 'user-token',
      })
      .mockResolvedValueOnce({ user: null, csrfToken: 'anonymous-token' })
    mockedApi.logout.mockResolvedValue()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(mockedApi.logout).toHaveBeenCalledOnce()
  })

  test('adds, completes, and removes todos with a refetch after each change', async () => {
    const user = userEvent.setup()
    const first: api.Todo = {
      id: 1,
      title: 'Plan the day',
      completed: false,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    const second: api.Todo = {
      id: 2,
      title: 'Ship the app',
      completed: false,
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T09:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second, first])
      .mockResolvedValueOnce([second, { ...first, completed: true }])
      .mockResolvedValueOnce([{ ...first, completed: true }])
    mockedApi.addTodo.mockResolvedValue(second)
    mockedApi.updateTodo.mockResolvedValue({ ...first, completed: true })
    mockedApi.removeTodo.mockResolvedValue()
    render(<App />)

    await screen.findByText('Plan the day')
    await user.type(screen.getByLabelText('New todo'), 'Ship the app')
    await user.click(screen.getByRole('button', { name: 'Add todo' }))
    expect(await screen.findByText('Ship the app')).toBeInTheDocument()
    expect(mockedApi.addTodo).toHaveBeenCalledWith('Ship the app')

    await user.click(screen.getByRole('checkbox', { name: 'Mark Plan the day completed' }))
    expect(await screen.findByRole('checkbox', { name: 'Mark Plan the day active' })).toBeChecked()
    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, true)

    await user.click(screen.getByRole('button', { name: 'Remove Ship the app' }))
    expect(await screen.findByText('1 completed')).toBeInTheDocument()
    expect(screen.queryByText('Ship the app')).not.toBeInTheDocument()
    expect(mockedApi.removeTodo).toHaveBeenCalledWith(2)
    expect(mockedApi.listTodos).toHaveBeenCalledTimes(4)
  })

  test('shows a retryable todo loading error', async () => {
    const user = userEvent.setup()
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos
      .mockRejectedValueOnce(new api.ApiError('Could not load todos'))
      .mockResolvedValueOnce([])
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load todos')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Your day is wide open.')).toBeInTheDocument()
  })
})
