import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { Card } from '../../components/ui/Card'
import { useTheme } from '../../hooks/useTheme'
import { categoricalColor } from '../../lib/chartColors'
import type { AnalyticsOverview } from '../../types/models'

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</p>
      {note && <p className="mt-1 text-xs text-[var(--text-muted)]">{note}</p>}
    </Card>
  )
}

function BarChartCard({
  title,
  data,
  dataKey,
  nameKey,
  caveat,
  isDark,
}: {
  title: string
  data: Record<string, string | number>[]
  dataKey: string
  nameKey: string
  caveat?: string
  isDark: boolean
}) {
  const gridColor = isDark ? '#2c2c2a' : '#e1e0d9'
  const tickColor = isDark ? '#c3c2b7' : '#52514e'
  const labelColor = isDark ? '#ffffff' : '#0b0b0b'

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {caveat && <p className="mt-1 text-xs text-[var(--status-warning)]">{caveat}</p>}
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: tickColor }} />
            <YAxis type="category" dataKey={nameKey} width={110} tick={{ fontSize: 12, fill: tickColor }} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              <LabelList dataKey={dataKey} position="right" style={{ fontSize: 12, fill: labelColor }} />
              {data.map((_, index) => (
                <Cell key={index} fill={categoricalColor(index, isDark)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`
}

function formatSeconds(value: number | null): string {
  if (value === null) return '—'
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  return `${minutes}m ${seconds}s`
}

export function AdminAnalyticsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const query = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get<AnalyticsOverview>('/api/analytics/overview'),
  })

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <LoadingState label="Loading analytics…" />
        </Card>
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <ErrorState message="Could not load analytics." />
      </div>
    )
  }

  const data = query.data

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Analytics</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Conversion (of total)" value={formatPercent(data.conversionRate.convertedOverTotal)} />
        <StatTile
          label="Conversion (of resolved)"
          value={formatPercent(data.conversionRate.convertedOverResolved)}
          note="Converted / (Converted + Lost)"
        />
        <StatTile label="Avg call duration" value={formatSeconds(data.callDuration.avgSeconds)} />
        <StatTile label="Calls with duration logged" value={String(data.callDuration.callsWithDuration)} />
      </div>

      <Card className="mb-6 p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Follow-up outcomes</h2>
        <p className="mt-1 text-xs text-[var(--status-warning)]">{data.followUpSuccess.note}</p>
        <div className="mt-3 flex flex-wrap gap-6 text-sm text-[var(--text-secondary)]">
          <span>
            Converted after follow-up:{' '}
            <strong className="text-[var(--text-primary)]">{data.followUpSuccess.convertedAfterFollowUp}</strong>
          </span>
          <span>
            Not converted after follow-up:{' '}
            <strong className="text-[var(--text-primary)]">{data.followUpSuccess.notConvertedAfterFollowUp}</strong>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarChartCard
          title="Lead pipeline by status"
          data={data.pipelineByStatus}
          dataKey="count"
          nameKey="status"
          isDark={isDark}
        />
        <BarChartCard
          title="Lead source distribution"
          data={data.leadsBySource}
          dataKey="count"
          nameKey="source"
          isDark={isDark}
        />
        <BarChartCard
          title="Course interest distribution"
          data={data.leadsByCourse}
          dataKey="count"
          nameKey="course"
          isDark={isDark}
        />
        <BarChartCard
          title="Sentiment distribution"
          data={data.sentimentDistribution.data}
          dataKey="count"
          nameKey="sentiment"
          caveat={data.sentimentDistribution.note}
          isDark={isDark}
        />
      </div>
    </div>
  )
}
