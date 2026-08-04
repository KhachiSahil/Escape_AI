import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../context/useAuth'
import { LeadTable } from '../components/LeadTable'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Field'
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
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {isEmployeeOnly ? 'My Assigned Leads' : 'All Leads'}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {leads ? `${leads.length} lead${leads.length === 1 ? '' : 's'}` : ' '}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value as LeadScore | '')}
            className="w-auto"
          >
            <option value="">All scores</option>
            {SCORE_OPTIONS.map((score) => (
              <option key={score} value={score}>
                {score.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-hairline)' }}>
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => setFollowUpOnly(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            Upcoming follow-up
          </label>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-auto"
          >
            <option value="">No sort</option>
            <option value="leadScore">Sort by lead score</option>
            <option value="compositeScore">Sort by composite score</option>
          </Select>
        </div>
      </div>

      {query.isLoading && (
        <Card>
          <LoadingState label="Loading leads…" />
        </Card>
      )}
      {query.isError && <ErrorState message="Could not load leads." />}
      {leads && (
        <Card className="overflow-hidden">
          <LeadTable leads={leads} />
        </Card>
      )}
    </div>
  )
}
