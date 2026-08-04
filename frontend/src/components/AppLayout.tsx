import { useState, type ReactElement } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useTheme } from '../hooks/useTheme'
import {
  ChartIcon,
  FlagIcon,
  LogIcon,
  LogoutIcon,
  MenuIcon,
  MoonIcon,
  PhoneIcon,
  SunIcon,
  UsersIcon,
} from './ui/icons'

interface NavItem {
  to: string
  label: string
  icon: (props: { className?: string }) => ReactElement
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/leads', label: 'Leads', icon: UsersIcon },
  { to: '/calls', label: 'Calls', icon: PhoneIcon },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/employees', label: 'Employees', icon: UsersIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/admin/escalations', label: 'Escalations', icon: FlagIcon },
  { to: '/admin/audit-log', label: 'Audit Log', icon: LogIcon },
]

function NavSection({ label, items, onNavigate }: { label?: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div>
      {label && (
        <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
      )}
      <nav className="space-y-0.5">
        {items.map(({ to, label: itemLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--brand-tint)] text-[var(--brand)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
              }`
            }
          >
            <Icon className="shrink-0" />
            {itemLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function SidebarContent({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      <NavSection items={PRIMARY_NAV} onNavigate={onNavigate} />
      {isAdmin && <NavSection label="Admin" items={ADMIN_NAV} onNavigate={onNavigate} />}
    </div>
  )
}

export function AppLayout() {
  const { employee, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const isAdmin = employee?.role === 'ADMIN' || employee?.role === 'MANAGER'

  useRealtimeSync()

  const initials = (employee?.name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-[var(--surface-page)]">
      {/* Desktop sidebar */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r bg-[var(--surface-1)] px-3 py-4 md:flex"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-[var(--brand-ink)]">
            E
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Escape CRM</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent isAdmin={isAdmin} />
        </div>
        <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-secondary)]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{employee?.name}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">{employee?.role}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              {theme === 'dark' ? <SunIcon width={15} height={15} /> : <MoonIcon width={15} height={15} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button
              onClick={logout}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <LogoutIcon width={15} height={15} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header
          className="flex items-center justify-between border-b bg-[var(--surface-1)] px-4 py-3 md:hidden"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            <MenuIcon />
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Escape CRM</span>
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        {mobileNavOpen && (
          <div
            className="border-b bg-[var(--surface-1)] px-3 py-4 md:hidden"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            <SidebarContent isAdmin={isAdmin} onNavigate={() => setMobileNavOpen(false)} />
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium text-[var(--text-secondary)]"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <LogoutIcon width={15} height={15} />
              Log out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
