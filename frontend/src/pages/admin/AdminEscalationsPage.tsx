import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import type { EscalationWithLead } from '../../types/models'

export function AdminEscalationsPage() {
  const query = useQuery({
    queryKey: ['escalations', 'queued'],
    queryFn: () => api.get<EscalationWithLead[]>('/api/escalations?status=queued'),
  })

  if (query.isLoading) return <LoadingState label="Loading escalation queue…" />
  if (query.isError || !query.data) return <ErrorState message="Could not load escalations." />

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Escalation Queue</h1>
      <p className="mb-6 text-sm text-gray-500">
        Escalations awaiting assignment (no active sales employee was available when created).
      </p>

      {query.data.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No queued escalations.
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-3 font-medium">Lead</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 font-medium">Summary</th>
                <th className="p-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((escalation) => (
                <tr key={escalation.id} className="border-b border-gray-100">
                  <td className="p-3">
                    <Link
                      to={`/leads/${escalation.leadId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {escalation.lead.name ?? escalation.lead.phone}
                    </Link>
                  </td>
                  <td className="p-3">{escalation.reason}</td>
                  <td className="p-3">{escalation.summary ?? '—'}</td>
                  <td className="p-3">{new Date(escalation.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
