'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getToken, setToken } from './api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api'

export interface AuthUser {
  id: string
  nome: string
  email: string
  role: string
  secretaria_id: string | null
  diretoria_id: string | null
}

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount: if user data is in localStorage, attempt a silent refresh via HttpOnly cookie.
  // This recovers the in-memory access token after a page reload.
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (!stored) {
      setLoading(false)
      return
    }
    fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { access_token: string } | null) => {
        if (data?.access_token) {
          setToken(data.access_token)
          try {
            setUser(JSON.parse(stored) as AuthUser)
          } catch {
            localStorage.removeItem('user')
          }
        } else {
          localStorage.removeItem('user')
        }
      })
      .catch(() => localStorage.removeItem('user'))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { message?: string })?.message ?? 'Credenciais inválidas')
    }
    const data = await res.json() as { access_token: string; usuario: AuthUser }
    setToken(data.access_token)
    localStorage.setItem('user', JSON.stringify(data.usuario))
    document.cookie = 'is_auth=1; path=/; SameSite=Lax'
    setUser(data.usuario)
  }, [])

  const logout = useCallback(async () => {
    const token = getToken()
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {})
    }
    setToken(null)
    localStorage.removeItem('user')
    document.cookie = 'is_auth=; Max-Age=0; path=/'
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
