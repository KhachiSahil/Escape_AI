import { Link } from 'react-router-dom'
import type { Lead } from '../types/models'
import { StatusBadge, ScoreBadge } from './LeadStatusBadge'
import { EmptyState } from './ui/EmptyState'
import { Table, Thead, Th, Tr, Td } from './ui/Table'

export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return <EmptyState title="No leads found" description="Try adjusting your filters." />
  }

  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th>Phone</Th>
        <Th>Course</Th>
        <Th>Status</Th>
        <Th>Score</Th>
      </Thead>
      <tbody>
        {leads.map((lead) => (
          <Tr key={lead.id}>
            <Td className="font-medium">
              <Link
                to={`/leads/${lead.id}`}
                className="text-[var(--brand)] hover:underline"
              >
                {lead.name ?? 'Unnamed'}
              </Link>
            </Td>
            <Td className="tabular-nums text-[var(--text-secondary)]">{lead.phone}</Td>
            <Td className="text-[var(--text-secondary)]">{lead.courseInterested ?? '—'}</Td>
            <Td>
              <StatusBadge status={lead.status} />
            </Td>
            <Td>{lead.leadScore ? <ScoreBadge score={lead.leadScore} /> : <span className="text-[var(--text-muted)]">—</span>}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}
