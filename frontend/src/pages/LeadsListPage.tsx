import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../context/useAuth'
import { LeadTable } from '../components/LeadTable'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import type { Lead } from '../types/models'

export function LeadsListPage() {
  const { employee, logout } = useAuth()
  const isEmployeeOnly = employee?.role === 'SALES_EMPLOYEE'

  const query = useQuery({
    queryKey: ['leads', isEmployeeOnly ? employee?.id : 'all'],
    queryFn: () =>
      api.get<Lead[]>(
        isEmployeeOnly ? `/api/leads?assignedEmployeeId=${employee!.id}` : '/api/leads',
      ),
  })

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isEmployeeOnly ? 'My Assigned Leads' : 'All Leads'}
          </h1>
          <p className="text-sm text-gray-500">Signed in as {employee?.name} ({employee?.role})</p>
        </div>
        <button
          onClick={logout}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Log out
        </button>
      </div>

      {query.isLoading && <LoadingState label="Loading leads…" />}
      {query.isError && <ErrorState message="Could not load leads." />}
      {query.data && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <LeadTable leads={query.data} />
        </div>
      )}
    </div>
  )
}
