import { Link } from 'react-router-dom'
import type { Lead } from '../types/models'
import { StatusBadge, ScoreBadge } from './LeadStatusBadge'

export function LeadTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return <p className="p-6 text-sm text-gray-500">No leads found.</p>
  }

  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-gray-500">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Phone</th>
          <th className="py-2 pr-4 font-medium">Course</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Score</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-2 pr-4">
              <Link to={`/leads/${lead.id}`} className="text-blue-600 hover:underline">
                {lead.name ?? 'Unnamed'}
              </Link>
            </td>
            <td className="py-2 pr-4">{lead.phone}</td>
            <td className="py-2 pr-4">{lead.courseInterested ?? '—'}</td>
            <td className="py-2 pr-4">
              <StatusBadge status={lead.status} />
            </td>
            <td className="py-2 pr-4">{lead.leadScore ? <ScoreBadge score={lead.leadScore} /> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
