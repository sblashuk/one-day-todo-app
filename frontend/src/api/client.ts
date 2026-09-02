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

export function setCsrfToken(token: string) {
  csrfToken = token
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
