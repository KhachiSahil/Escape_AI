import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../context/useAuth'
import { LeadTable } from '../components/LeadTable'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import type { Lead, LeadScore } from '../types/models'

const SCORE_OPTIONS: LeadScore[] = ['VERY_HOT', 'HOT', 'WARM', 'COLD', 'RE_ENGAGE', 'DORMANT', 'LOST']
const SCORE_RANK: Record<LeadScore, number> = {
  VERY_HOT: 0,
  HOT: 1,
  WARM: 2,
  COLD: 3,
  RE_ENGAGE: 4,
  DORMANT: 5,
  LOST: 6,
}

export function LeadsListPage() {
  const { employee } = useAuth()
  const isEmployeeOnly = employee?.role === 'SALES_EMPLOYEE'
  const [scoreFilter, setScoreFilter] = useState<LeadScore | ''>('')
  const [sortBy, setSortBy] = useState<'' | 'leadScore' | 'compositeScore'>('')
  const [followUpOnly, setFollowUpOnly] = useState(false)

  const query = useQuery({
    queryKey: ['leads', isEmployeeOnly ? employee?.id : 'all'],
    queryFn: () =>
      api.get<Lead[]>(
        isEmployeeOnly ? `/api/leads?assignedEmployeeId=${employee!.id}` : '/api/leads',
      ),
  })

  const leads = useMemo(() => {
    if (!query.data) return undefined
    let result = query.data
    if (scoreFilter) {
      result = result.filter((lead) => lead.leadScore === scoreFilter)
    }
    if (followUpOnly) {
      result = result.filter((lead) => lead.nextFollowUp != null)
    }
    if (sortBy === 'leadScore') {
      result = [...result].sort((a, b) => {
        const rankA = a.leadScore ? SCORE_RANK[a.leadScore] : 99
        const rankB = b.leadScore ? SCORE_RANK[b.leadScore] : 99
        return rankA - rankB
      })
    } else if (sortBy === 'compositeScore') {
      result = [...result].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
    }
    return result
  }, [query.data, scoreFilter, sortBy, followUpOnly])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {isEmployeeOnly ? 'My Assigned Leads' : 'All Leads'}
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value as LeadScore | '')}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All scores</option>
            {SCORE_OPTIONS.map((score) => (
              <option key={score} value={score}>
                {score.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => setFollowUpOnly(e.target.checked)}
            />
            Has upcoming follow-up
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">No sort</option>
            <option value="leadScore">Sort by lead score</option>
            <option value="compositeScore">Sort by composite score</option>
          </select>
        </div>
      </div>

      {query.isLoading && <LoadingState label="Loading leads…" />}
      {query.isError && <ErrorState message="Could not load leads." />}
      {leads && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <LeadTable leads={leads} />
        </div>
      )}
    </div>
  )
}
