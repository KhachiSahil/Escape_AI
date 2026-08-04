import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Field'
import { Table, Thead, Th, Tr, Td } from '../components/ui/Table'
import type { CallWithLead } from '../types/models'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTomorrow(): Date {
  const d = startOfDay(new Date())
  d.setDate(d.getDate() + 1)
  return d
}

export function CallsPage() {
  const [range, setRange] = useState<'today' | 'all'>('today')

  const query = useQuery({
    queryKey: ['calls', range],
    queryFn: () => {
      const params = new URLSearchParams()
      if (range === 'today') {
        params.set('from', startOfDay(new Date()).toISOString())
        params.set('to', startOfTomorrow().toISOString())
      }
      const qs = params.toString()
      return api.get<CallWithLead[]>(`/api/calls${qs ? `?${qs}` : ''}`)
    },
  })

  const calls = useMemo(() => query.data ?? [], [query.data])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Calls</h1>
        <Select value={range} onChange={(e) => setRange(e.target.value as 'today' | 'all')} className="w-auto">
          <option value="today">Today</option>
          <option value="all">All time</option>
        </Select>
      </div>

      {query.isLoading && (
        <Card>
          <LoadingState label="Loading calls…" />
        </Card>
      )}
      {query.isError && <ErrorState message="Could not load calls." />}
      {!query.isLoading && !query.isError && (
        <Card className="overflow-hidden">
          {calls.length === 0 ? (
            <EmptyState title="No calls in this range" description="Try switching to All time." />
          ) : (
            <Table>
              <Thead>
                <Th>Lead</Th>
                <Th>Type</Th>
                <Th>Summary</Th>
                <Th>Duration</Th>
                <Th>When</Th>
              </Thead>
              <tbody>
                {calls.map((call) => (
                  <Tr key={call.id}>
                    <Td className="font-medium">
                      <Link to={`/leads/${call.leadId}`} className="text-[var(--brand)] hover:underline">
                        {call.lead.name ?? call.lead.phone}
                      </Link>
                    </Td>
                    <Td className="text-[var(--text-secondary)]">{call.callType}</Td>
                    <Td className="text-[var(--text-secondary)]">{call.shortSummary ?? '—'}</Td>
                    <Td className="tabular-nums text-[var(--text-secondary)]">
                      {call.durationSeconds != null ? `${call.durationSeconds}s` : '—'}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">{new Date(call.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
