import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
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
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Calls</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as 'today' | 'all')}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="today">Today</option>
          <option value="all">All time</option>
        </select>
      </div>

      {query.isLoading && <LoadingState label="Loading calls…" />}
      {query.isError && <ErrorState message="Could not load calls." />}
      {!query.isLoading && !query.isError && (
        <div className="rounded-lg border border-gray-200 bg-white">
          {calls.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No calls in this range.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="p-3 font-medium">Lead</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Summary</th>
                  <th className="p-3 font-medium">Duration</th>
                  <th className="p-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id} className="border-b border-gray-100">
                    <td className="p-3">
                      <Link to={`/leads/${call.leadId}`} className="text-blue-600 hover:underline">
                        {call.lead.name ?? call.lead.phone}
                      </Link>
                    </td>
                    <td className="p-3">{call.callType}</td>
                    <td className="p-3">{call.shortSummary ?? '—'}</td>
                    <td className="p-3">
                      {call.durationSeconds != null ? `${call.durationSeconds}s` : '—'}
                    </td>
                    <td className="p-3">{new Date(call.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
