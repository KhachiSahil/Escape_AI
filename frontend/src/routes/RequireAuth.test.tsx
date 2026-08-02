import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { RequireAuth } from './RequireAuth'

function renderWithAuth(roles?: ('ADMIN' | 'MANAGER' | 'SALES_EMPLOYEE')[]) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/leads" element={<div>leads page</div>} />
          <Route
            path="/protected"
            element={
              <RequireAuth roles={roles}>
                <div>protected content</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to /login when there is no authenticated employee', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    )

    renderWithAuth()

    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument())
  })

  it('renders protected content once an employee is authenticated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ employee: { id: '1', name: 'Admin', email: 'a@b.com', role: 'ADMIN' } }),
        { status: 200 },
      ),
    )

    renderWithAuth()

    await waitFor(() => expect(screen.getByText('protected content')).toBeInTheDocument())
  })

  it('redirects to /leads when the employee role is not in the allowed list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          employee: { id: '1', name: 'Employee One', email: 'e@b.com', role: 'SALES_EMPLOYEE' },
        }),
        { status: 200 },
      ),
    )

    renderWithAuth(['ADMIN', 'MANAGER'])

    await waitFor(() => expect(screen.getByText('leads page')).toBeInTheDocument())
  })
})
