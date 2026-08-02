import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import type { Role } from '../types/models'

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { token, employee } = useAuth()

  if (!token || !employee) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(employee.role)) {
    return <Navigate to="/leads" replace />
  }

  return children
}
