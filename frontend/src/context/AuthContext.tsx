import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import type { Employee, LoginResponse } from '../types/models'

type EmployeeSummary = Pick<Employee, 'id' | 'name' | 'email' | 'role'>

interface AuthContextValue {
  employee: EmployeeSummary | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      setEmployee(null)
      queryClient.clear()
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setEmployee(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  // The JWT lives in an httpOnly cookie now, invisible to JS - identity is
  // rehydrated by asking the server who the cookie belongs to.
  useEffect(() => {
    api
      .get<{ employee: EmployeeSummary }>('/api/auth/me')
      .then((response) => setEmployee(response.employee))
      .catch(() => setEmployee(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/api/auth/login', { email, password })
    setEmployee(response.employee)
  }, [])

  return (
    <AuthContext.Provider value={{ employee, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
