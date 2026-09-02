import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    vi.useRealTimers()
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

  test('adds a todo with a local due date and priority', async () => {
    const user = userEvent.setup()
    const dueAt = new Date(2026, 8, 3, 14, 30).toISOString()
    const created: api.Todo = {
      id: 1,
      title: 'Ship the app',
      completed: false,
      dueAt,
      priority: 'high',
      createdAt: '2026-09-02T08:00:00Z',
      updatedAt: '2026-09-02T08:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValueOnce([]).mockResolvedValueOnce([created])
    mockedApi.addTodo.mockResolvedValue(created)
    render(<App />)

    await user.type(await screen.findByLabelText('New todo'), 'Ship the app')
    fireEvent.change(screen.getByLabelText('Due date and time'), {
      target: { value: '2026-09-03T14:30' },
    })
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Add todo' }))

    expect(mockedApi.addTodo).toHaveBeenCalledWith({
      title: 'Ship the app',
      dueAt,
      priority: 'high',
    })
    expect(await screen.findByText('High priority')).toBeInTheDocument()
    expect(screen.getByLabelText('New todo')).toHaveValue('')
    expect(screen.getByLabelText('Due date and time')).toHaveValue('')
    expect(screen.getByLabelText('Priority')).toHaveValue('')
  })

  test('edits todo details inline and can cancel without saving', async () => {
    const user = userEvent.setup()
    const original: api.Todo = {
      id: 1,
      title: 'Draft release',
      completed: false,
      dueAt: null,
      priority: null,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    const dueAt = new Date(2026, 8, 4, 9, 15).toISOString()
    const updated: api.Todo = {
      ...original,
      title: 'Ship release',
      dueAt,
      priority: 'medium',
      updatedAt: '2026-09-02T09:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValueOnce([original]).mockResolvedValueOnce([updated])
    mockedApi.updateTodo.mockResolvedValue(updated)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Edit Draft release' }))
    await user.clear(screen.getByLabelText('Edit title for Draft release'))
    await user.type(screen.getByLabelText('Edit title for Draft release'), 'Discard me')
    await user.click(screen.getByRole('button', { name: 'Cancel editing Draft release' }))
    expect(screen.getByText('Draft release')).toBeInTheDocument()
    expect(mockedApi.updateTodo).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Edit Draft release' }))
    await user.clear(screen.getByLabelText('Edit title for Draft release'))
    await user.type(screen.getByLabelText('Edit title for Draft release'), 'Ship release')
    fireEvent.change(screen.getByLabelText('Edit due date and time for Draft release'), {
      target: { value: '2026-09-04T09:15' },
    })
    await user.selectOptions(screen.getByLabelText('Edit priority for Draft release'), 'medium')
    await user.click(screen.getByRole('button', { name: 'Save Draft release' }))

    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, {
      title: 'Ship release',
      dueAt,
      priority: 'medium',
    })
    expect(await screen.findByText('Ship release')).toBeInTheDocument()
    expect(screen.getByText('Medium priority')).toBeInTheDocument()
  })

  test('changes a due-today todo to overdue while the page remains open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 14, 0, 0))
    const dueAt = new Date(2026, 8, 2, 14, 0, 15).toISOString()
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([
      {
        id: 1,
        title: 'Join the call',
        completed: false,
        dueAt,
        priority: 'high',
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
      },
    ])

    await act(async () => render(<App />))

    expect(screen.getByText(/^Today ·/)).toBeInTheDocument()
    expect(screen.getByText('High priority')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByText(/^Overdue ·/)).toBeInTheDocument()
  })

  test('shows completed metadata without active urgency wording', async () => {
    const user = userEvent.setup()
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([
      {
        id: 1,
        title: 'Filed report',
        completed: true,
        dueAt: '2020-01-01T09:00:00Z',
        priority: 'low',
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
      },
    ])
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Completed (1)' }))

    expect(screen.getByText('Low priority')).toBeInTheDocument()
    expect(screen.getByText(/^Due ·/)).toBeInTheDocument()
    expect(screen.queryByText(/^Overdue ·/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Filed report' })).toBeInTheDocument()
  })

  test('keeps the inline editor open with server field errors', async () => {
    const user = userEvent.setup()
    const todo: api.Todo = {
      id: 1,
      title: 'Plan release',
      completed: false,
      dueAt: null,
      priority: null,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    mockedApi.getSession.mockResolvedValue({
      user: { id: 1, email: 'person@example.com' },
      csrfToken: 'token',
    })
    mockedApi.listTodos.mockResolvedValue([todo])
    mockedApi.updateTodo.mockRejectedValue(
      new api.ApiError('Check the highlighted fields.', 'validation_error', {
        priority: 'Priority must be low, medium, or high.',
      }),
    )
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Edit Plan release' }))
    await user.click(screen.getByRole('button', { name: 'Save Plan release' }))

    expect(await screen.findByText('Priority must be low, medium, or high.')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit title for Plan release')).toBeInTheDocument()
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
        dueAt: null,
        priority: null,
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
        dueAt: null,
        priority: null,
        createdAt: '2026-09-01T09:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
      },
      {
        id: 1,
        title: 'Plan the day',
        completed: true,
        dueAt: null,
        priority: null,
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
      dueAt: null,
      priority: null,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    }
    const removed: api.Todo = {
      id: 2,
      title: 'Ship the app',
      completed: true,
      dueAt: null,
      priority: null,
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
    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, { completed: false })

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
      dueAt: null,
      priority: null,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
    }
    const second: api.Todo = {
      id: 2,
      title: 'Ship the app',
      completed: false,
      dueAt: null,
      priority: null,
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
    expect(mockedApi.addTodo).toHaveBeenCalledWith({
      title: 'Ship the app',
      dueAt: null,
      priority: null,
    })

    await user.click(screen.getByRole('checkbox', { name: 'Mark Plan the day completed' }))
    expect(await screen.findByRole('button', { name: 'Completed (1)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.animationEnd(screen.getByText('Plan the day').closest('li')!)
    await waitFor(() => {
      expect(screen.queryByText('Plan the day')).not.toBeInTheDocument()
    })
    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, { completed: true })

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
      dueAt: null,
      priority: null,
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

    expect(mockedApi.updateTodo).toHaveBeenCalledWith(1, { completed: true })
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
      dueAt: null,
      priority: null,
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
      dueAt: null,
      priority: null,
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
