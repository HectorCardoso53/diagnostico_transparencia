const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api'

// Access token kept in memory — invisible to XSS scripts, recovered via cookie on page reload
let memoryToken: string | null = null

export function setToken(token: string | null) {
  memoryToken = token
}

export function getToken(): string | null {
  return memoryToken
}

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return false
  const data = await res.json()
  memoryToken = data.access_token as string
  return true
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(path, options, false)
    memoryToken = null
    localStorage.removeItem('user')
    document.cookie = 'is_auth=; Max-Age=0; path=/'
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  if (res.status === 204) return null as T

  const body = await res.json()
  if (!res.ok) throw new Error(body?.message ?? `Erro ${res.status}`)
  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
