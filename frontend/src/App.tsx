import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { LeadsListPage } from './pages/LeadsListPage'
import { LeadDetailPage } from './pages/LeadDetailPage'
import { AdminEmployeesPage } from './pages/admin/AdminEmployeesPage'
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage'
import { AdminEscalationsPage } from './pages/admin/AdminEscalationsPage'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './routes/RequireAuth'

const ADMIN_ROLES = ['ADMIN', 'MANAGER'] as const

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/leads" element={<LeadsListPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route
          path="/admin/employees"
          element={
            <RequireAuth roles={[...ADMIN_ROLES]}>
              <AdminEmployeesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <RequireAuth roles={[...ADMIN_ROLES]}>
              <AdminAnalyticsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/escalations"
          element={
            <RequireAuth roles={[...ADMIN_ROLES]}>
              <AdminEscalationsPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  )
}

export default App
