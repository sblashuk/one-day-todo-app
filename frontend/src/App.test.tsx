import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.queryByRole('button', { name: /Completed/ })).not.toBeInTheDocument()
  })

  test('celebrates an all-complete list above the completed section', async () => {
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([
      {
        id: 1,
        title: 'Plan the day',
        completed: true,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ])
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'All done for today.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed (1)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  test('keeps completed todos in a collapsible section', async () => {
    const user = userEvent.setup()
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([
      {
        id: 2,
        title: 'Ship the app',
        completed: false,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
      {
        id: 1,
        title: 'Plan the day',
        completed: true,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
    ])
    render(<App />)

    expect(await screen.findByRole('list', { name: 'Active todos' })).toHaveTextContent(
      'Ship the app',
    )
    expect(screen.queryByText('Plan the day')).not.toBeInTheDocument()

    const completedToggle = screen.getByRole('button', { name: 'Completed (1)' })
    expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(completedToggle)
    expect(completedToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('list', { name: 'Completed todos' })).toHaveTextContent('Plan the day')

    await user.click(completedToggle)
    expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Plan the day')).not.toBeInTheDocument()
  })

  test('restores and removes todos from the completed section', async () => {
    const user = userEvent.setup()
    const restored: api.Todo = {
      id: 1,
      title: 'Plan the day',
      completed: true,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    }
    const removed: api.Todo = {
      id: 2,
      title: 'Ship the app',
      completed: true,
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos
      .mockResolvedValueOnce([removed, restored])
      .mockResolvedValueOnce([{ ...restored, completed: false }, removed])
      .mockResolvedValueOnce([{ ...restored, completed: false }])
    mockedApi.updateTodo.mockResolvedValue({ ...restored, completed: false })
    mockedApi.removeTodo.mockResolvedValue()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Completed (2)' }))
    await user.click(screen.getByRole('checkbox', { name: 'Mark Plan the day active' }))

    expect(await screen.findByRole('list', { name: 'Active todos' })).toHaveTextContent(
      'Plan the day',
    )
    expect(screen.getByRole('button', { name: 'Completed (1)' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, false)

    await user.click(screen.getByRole('button', { name: 'Remove Ship the app' }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Completed/ })).not.toBeInTheDocument()
    })
    expect(mockedApi.removeTodo).toHaveBeenCalledWith(2)
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
    expect(await screen.findByRole('button', { name: 'Completed (1)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.animationEnd(screen.getByText('Plan the day').closest('li')!)
    await waitFor(() => {
      expect(screen.queryByText('Plan the day')).not.toBeInTheDocument()
    })
    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, true)

    await user.click(screen.getByRole('button', { name: 'Remove Ship the app' }))
    expect(await screen.findByText('1 completed')).toBeInTheDocument()
    expect(screen.queryByText('Ship the app')).not.toBeInTheDocument()
    expect(mockedApi.removeTodo).toHaveBeenCalledWith(2)
    expect(mockedApi.listTodos).toHaveBeenCalledTimes(4)
  })

  test('confirms a completed todo before filing it under the collapsed completed section', async () => {
    const user = userEvent.setup()
    const todo: api.Todo = {
      id: 1,
      title: 'Plan the day',
      completed: false,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    let confirmCompletion: ((todo: api.Todo) => void) | undefined
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos
      .mockResolvedValueOnce([todo])
      .mockResolvedValueOnce([{ ...todo, completed: true }])
    mockedApi.updateTodo.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirmCompletion = resolve
        }),
    )
    render(<App />)

    await user.click(
      await screen.findByRole('checkbox', { name: 'Mark Plan the day completed' }),
    )

    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, true)
    expect(screen.getByRole('list', { name: 'Active todos' })).toHaveTextContent('Plan the day')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    confirmCompletion?.({ ...todo, completed: true })

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Plan the day moved to Completed.',
    )
    const completedToggle = screen.getByRole('button', { name: 'Completed (1)' })
    expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Completed todos' })).not.toBeInTheDocument()

    const departingTodo = screen.getByText('Plan the day').closest('li')
    expect(departingTodo).toBeVisible()
    fireEvent.animationEnd(departingTodo!)

    await waitFor(() => {
      expect(screen.queryByText('Plan the day')).not.toBeInTheDocument()
    })
  })

  test('keeps a todo active without a completion cue when completion fails', async () => {
    const user = userEvent.setup()
    const todo: api.Todo = {
      id: 1,
      title: 'Plan the day',
      completed: false,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([todo])
    mockedApi.updateTodo.mockRejectedValue(new api.ApiError('Could not complete todo'))
    render(<App />)

    await user.click(
      await screen.findByRole('checkbox', { name: 'Mark Plan the day completed' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete todo')
    expect(screen.getByRole('list', { name: 'Active todos' })).toHaveTextContent('Plan the day')
    expect(
      screen.getByRole('checkbox', { name: 'Mark Plan the day completed' }),
    ).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Completed/ })).not.toBeInTheDocument()
  })

  test('waits for a successful todo refresh before showing the completion cue', async () => {
    const user = userEvent.setup()
    const todo: api.Todo = {
      id: 1,
      title: 'Plan the day',
      completed: false,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos
      .mockResolvedValueOnce([todo])
      .mockRejectedValueOnce(new api.ApiError('Could not refresh todos'))
    mockedApi.updateTodo.mockResolvedValue({ ...todo, completed: true })
    render(<App />)

    await user.click(
      await screen.findByRole('checkbox', { name: 'Mark Plan the day completed' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not refresh todos')
    expect(screen.getByRole('list', { name: 'Active todos' })).toHaveTextContent('Plan the day')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Completed/ })).not.toBeInTheDocument()
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
