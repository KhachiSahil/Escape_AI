import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { categoricalColor } from '../../lib/chartColors'
import type { AnalyticsOverview } from '../../types/models'

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-400">{note}</p>}
    </div>
  )
}

function BarChartCard({
  title,
  data,
  dataKey,
  nameKey,
  caveat,
}: {
  title: string
  data: Record<string, string | number>[]
  dataKey: string
  nameKey: string
  caveat?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-medium text-gray-900">{title}</h2>
      {caveat && <p className="mt-1 text-xs text-amber-600">{caveat}</p>}
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey={nameKey} width={110} tick={{ fontSize: 12 }} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              <LabelList dataKey={dataKey} position="right" style={{ fontSize: 12 }} />
              {data.map((_, index) => (
                <Cell key={index} fill={categoricalColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
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
  const query = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get<AnalyticsOverview>('/api/analytics/overview'),
  })

  if (query.isLoading) return <LoadingState label="Loading analytics…" />
  if (query.isError || !query.data) return <ErrorState message="Could not load analytics." />

  const data = query.data

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Analytics</h1>

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

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-900">Follow-up outcomes</h2>
        <p className="mt-1 text-xs text-amber-600">{data.followUpSuccess.note}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            Converted after follow-up: <strong>{data.followUpSuccess.convertedAfterFollowUp}</strong>
          </span>
          <span>
            Not converted after follow-up:{' '}
            <strong>{data.followUpSuccess.notConvertedAfterFollowUp}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BarChartCard
          title="Lead pipeline by status"
          data={data.pipelineByStatus}
          dataKey="count"
          nameKey="status"
        />
        <BarChartCard
          title="Lead source distribution"
          data={data.leadsBySource}
          dataKey="count"
          nameKey="source"
        />
        <BarChartCard
          title="Course interest distribution"
          data={data.leadsByCourse}
          dataKey="count"
          nameKey="course"
        />
        <BarChartCard
          title="Sentiment distribution"
          data={data.sentimentDistribution.data}
          dataKey="count"
          nameKey="sentiment"
          caveat={data.sentimentDistribution.note}
        />
      </div>
    </div>
  )
}
