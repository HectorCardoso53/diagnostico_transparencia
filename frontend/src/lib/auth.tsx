'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

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
  isAuthenticated: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.clear()
      }
    }
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.message ?? 'Credenciais inválidas')
    }
    const data = await res.json()
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user_id', data.usuario.id)
    localStorage.setItem('user', JSON.stringify(data.usuario))
    // Cookie for proxy route protection
    document.cookie = 'is_auth=1; path=/; SameSite=Lax'
    setUser(data.usuario)
  }, [])

  const logout = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.clear()
    document.cookie = 'is_auth=; Max-Age=0; path=/'
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <Ctx.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
