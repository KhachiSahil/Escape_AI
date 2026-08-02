import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, setAuthToken, setUnauthorizedHandler } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import type { Employee, LoginResponse } from '../types/models'

const STORAGE_KEY = 'escapeai_auth'

interface StoredAuth {
  token: string
  employee: Pick<Employee, 'id' | 'name' | 'email' | 'role'>
}

interface AuthContextValue {
  token: string | null
  employee: StoredAuth['employee'] | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): StoredAuth | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStoredAuth())

  useEffect(() => {
    setAuthToken(auth?.token ?? null)
  }, [auth])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAuth(null)
    setAuthToken(null)
    queryClient.clear()
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/api/auth/login', { email, password })
    const next: StoredAuth = { token: response.token, employee: response.employee }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setAuth(next)
  }, [])

  return (
    <AuthContext.Provider
      value={{ token: auth?.token ?? null, employee: auth?.employee ?? null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}
