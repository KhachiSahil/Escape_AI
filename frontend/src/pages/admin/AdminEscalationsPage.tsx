import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Table, Thead, Th, Tr, Td } from '../../components/ui/Table'
import type { EscalationWithLead } from '../../types/models'

export function AdminEscalationsPage() {
  const query = useQuery({
    queryKey: ['escalations', 'queued'],
    queryFn: () => api.get<EscalationWithLead[]>('/api/escalations?status=queued'),
  })

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <LoadingState label="Loading escalation queue…" />
        </Card>
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <ErrorState message="Could not load escalations." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">Escalation Queue</h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        Escalations awaiting assignment (no active sales employee was available when created).
      </p>

      <Card className="overflow-hidden">
        {query.data.length === 0 ? (
          <EmptyState title="No queued escalations" description="Everything is currently assigned." />
        ) : (
          <Table>
            <Thead>
              <Th>Lead</Th>
              <Th>Reason</Th>
              <Th>Summary</Th>
              <Th>Created</Th>
            </Thead>
            <tbody>
              {query.data.map((escalation) => (
                <Tr key={escalation.id}>
                  <Td className="font-medium">
                    <Link to={`/leads/${escalation.leadId}`} className="text-[var(--brand)] hover:underline">
                      {escalation.lead.name ?? escalation.lead.phone}
                    </Link>
                  </Td>
                  <Td className="text-[var(--text-secondary)]">{escalation.reason}</Td>
                  <Td className="text-[var(--text-secondary)]">{escalation.summary ?? '—'}</Td>
                  <Td className="text-[var(--text-secondary)]">{new Date(escalation.createdAt).toLocaleString()}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
