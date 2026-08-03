import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import type { AuditLogEntry } from '../../types/models'

export function AdminAuditLogPage() {
  const query = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.get<AuditLogEntry[]>('/api/audit-log'),
  })

  if (query.isLoading) return <LoadingState label="Loading audit log…" />
  if (query.isError || !query.data) return <ErrorState message="Could not load the audit log." />

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Audit Log</h1>
      <p className="mb-6 text-sm text-gray-500">
        A record of who changed what across leads, calls, escalations, and employees.
      </p>

      {query.data.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No audit entries yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-3 font-medium">Entity</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Changes</th>
                <th className="p-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="p-3">
                    {entry.entityType} <span className="text-gray-400">{entry.entityId}</span>
                  </td>
                  <td className="p-3">{entry.action}</td>
                  <td className="p-3">{entry.actorId ?? 'system'}</td>
                  <td className="p-3 font-mono text-xs text-gray-600">
                    {entry.changes ? JSON.stringify(entry.changes) : '—'}
                  </td>
                  <td className="p-3">{new Date(entry.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
