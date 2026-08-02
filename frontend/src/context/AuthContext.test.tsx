import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

function TestConsumer() {
  const { employee, isLoading } = useAuth()
  if (isLoading) return <div>loading</div>
  return <div>{employee ? `logged in as ${employee.name}` : 'logged out'}</div>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rehydrates identity from GET /api/auth/me on mount', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ employee: { id: '1', name: 'Admin', email: 'a@b.com', role: 'ADMIN' } }),
        { status: 200 },
      ),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('logged in as Admin')).toBeInTheDocument())
  })

  it('treats a failed /me call as logged-out', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('logged out')).toBeInTheDocument())
  })
})
