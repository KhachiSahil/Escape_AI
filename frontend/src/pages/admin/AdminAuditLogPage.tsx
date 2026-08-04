import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Table, Thead, Th, Tr, Td } from '../../components/ui/Table'
import type { AuditLogEntry } from '../../types/models'

export function AdminAuditLogPage() {
  const query = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.get<AuditLogEntry[]>('/api/audit-log'),
  })

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <LoadingState label="Loading audit log…" />
        </Card>
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <ErrorState message="Could not load the audit log." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">Audit Log</h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        A record of who changed what across leads, calls, escalations, and employees.
      </p>

      <Card className="overflow-hidden">
        {query.data.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <Table>
            <Thead>
              <Th>Entity</Th>
              <Th>Action</Th>
              <Th>Actor</Th>
              <Th>Changes</Th>
              <Th>When</Th>
            </Thead>
            <tbody>
              {query.data.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="font-medium">
                    {entry.entityType} <span className="font-normal text-[var(--text-muted)]">{entry.entityId}</span>
                  </Td>
                  <Td className="text-[var(--text-secondary)]">{entry.action}</Td>
                  <Td className="text-[var(--text-secondary)]">{entry.actorId ?? 'system'}</Td>
                  <Td className="font-mono text-xs text-[var(--text-muted)]">
                    {entry.changes ? JSON.stringify(entry.changes) : '—'}
                  </Td>
                  <Td className="text-[var(--text-secondary)]">{new Date(entry.createdAt).toLocaleString()}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
