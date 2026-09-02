import { describe, expect, test, vi } from 'vitest'

import { addTodo, getSession, listCompletions, login, removeTodo, updateTodo } from './api'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HTTP client', () => {
  test('stores the session CSRF token and sends it with mutations', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user: null, csrfToken: 'csrf-123' }))
      .mockResolvedValueOnce(
        jsonResponse({
          todo: {
            id: 1,
            title: 'Plan the day',
            completed: false,
            createdAt: '2026-09-01T08:00:00Z',
            updatedAt: '2026-09-01T08:00:00Z',
          },
        }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)

    await getSession()
    await addTodo({
      title: 'Plan the day',
      dueAt: '2026-09-02T12:30:00Z',
      priority: 'high',
    })

    const [, init] = fetchMock.mock.calls[1]
    const headers = init?.headers as Headers
    expect(init?.credentials).toBe('same-origin')
    expect(headers.get('X-CSRFToken')).toBe('csrf-123')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe(
      JSON.stringify({
        title: 'Plan the day',
        dueAt: '2026-09-02T12:30:00Z',
        priority: 'high',
      }),
    )
  })

  test('sends partial todo updates without overwriting other fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        todo: {
          id: 7,
          title: 'Ship the app',
          completed: false,
          dueAt: null,
          priority: null,
          createdAt: '2026-09-01T08:00:00Z',
          updatedAt: '2026-09-02T08:00:00Z',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateTodo(7, { title: 'Ship the app', dueAt: null, priority: null })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos/7',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ title: 'Ship the app', dueAt: null, priority: null }),
      }),
    )
  })

  test('normalizes structured server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'validation_error',
              message: 'Check the highlighted fields.',
              fields: { email: 'Enter a valid email address.' },
            },
          },
          400,
        ),
      ),
    )

    await expect(login('bad', 'password1')).rejects.toMatchObject({
      code: 'validation_error',
      message: 'Check the highlighted fields.',
      fields: { email: 'Enter a valid email address.' },
    })
  })

  test('supports empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(removeTodo(7)).resolves.toBeUndefined()
  })

  test('turns network failures into a helpful error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')))

    await expect(getSession()).rejects.toMatchObject({ code: 'network_error' })
  })

  test('encodes completion range parameters and parses timestamps', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ completions: [{ completedAt: '2026-09-02T08:00:00Z' }] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      listCompletions('2026-06-15T00:00:00+02:00', '2026-09-07T00:00:00+02:00'),
    ).resolves.toEqual([{ completedAt: '2026-09-02T08:00:00Z' }])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity/completions?from=2026-06-15T00%3A00%3A00%2B02%3A00&to=2026-09-07T00%3A00%3A00%2B02%3A00',
      expect.anything(),
    )
  })
})
