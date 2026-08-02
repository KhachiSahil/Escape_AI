import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useRealtimeSync } from '../hooks/useRealtimeSync'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`

export function AppLayout() {
  const { employee, logout } = useAuth()
  const isAdmin = employee?.role === 'ADMIN' || employee?.role === 'MANAGER'

  useRealtimeSync()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-gray-900">Escape AI CRM</span>
            <nav className="flex items-center gap-1">
              <NavLink to="/leads" className={navLinkClass}>
                Leads
              </NavLink>
              {isAdmin && (
                <>
                  <NavLink to="/admin/employees" className={navLinkClass}>
                    Employees
                  </NavLink>
                  <NavLink to="/admin/analytics" className={navLinkClass}>
                    Analytics
                  </NavLink>
                  <NavLink to="/admin/escalations" className={navLinkClass}>
                    Escalations
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {employee?.name} ({employee?.role})
            </span>
            <button
              onClick={logout}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
