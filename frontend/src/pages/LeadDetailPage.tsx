import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/useAuth'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { StatusBadge, ScoreBadge } from '../components/LeadStatusBadge'
import type { LeadDetail, LeadStatus, UpdateLeadInput } from '../types/models'

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW',
  'QUALIFIED',
  'CALLBACK_SCHEDULED',
  'ESCALATED',
  'CONVERTED',
  'LOST',
  'DORMANT',
]

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { employee } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<LeadDetail>(`/api/leads/${id}`),
    enabled: !!id,
  })

  const [status, setStatus] = useState<LeadStatus | ''>('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: UpdateLeadInput) => api.patch<LeadDetail>(`/api/leads/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setFormError(null)
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.body.error : 'Update failed')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input: UpdateLeadInput = {}
    if (status) input.status = status
    if (notes) input.notes = notes
    mutation.mutate(input)
  }

  if (query.isLoading) return <LoadingState label="Loading lead…" />
  if (query.isError || !query.data) return <ErrorState message="Could not load this lead." />

  const lead = query.data
  const canEdit =
    employee?.role === 'ADMIN' ||
    employee?.role === 'MANAGER' ||
    (employee?.role === 'SALES_EMPLOYEE' && lead.assignedEmployeeId === employee.id)

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/leads" className="text-sm text-blue-600 hover:underline">
        ← Back to leads
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{lead.name ?? 'Unnamed lead'}</h1>
          <div className="flex gap-2">
            <StatusBadge status={lead.status} />
            {lead.leadScore && <ScoreBadge score={lead.leadScore} />}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Phone</dt>
          <dd>{lead.phone}</dd>
          <dt className="text-gray-500">Email</dt>
          <dd>{lead.email ?? '—'}</dd>
          <dt className="text-gray-500">Course interested</dt>
          <dd>{lead.courseInterested ?? '—'}</dd>
          <dt className="text-gray-500">Profession</dt>
          <dd>{lead.profession ?? '—'}</dd>
          <dt className="text-gray-500">Budget</dt>
          <dd>{lead.budget ?? '—'}</dd>
          <dt className="text-gray-500">Assigned to</dt>
          <dd>{lead.assignedEmployee?.name ?? 'Unassigned'}</dd>
          <dt className="text-gray-500">Notes</dt>
          <dd className="whitespace-pre-wrap">{lead.notes ?? '—'}</dd>
        </dl>

        {canEdit && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-medium text-gray-900">Update lead</h2>
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-gray-500">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">— unchanged —</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-xs font-medium text-gray-500">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-medium text-gray-900">Call history</h2>
          {lead.calls.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No calls yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {lead.calls.map((call) => (
                <li key={call.id} className="rounded border border-gray-100 p-2">
                  <span className="font-medium">{call.callType}</span> —{' '}
                  {call.shortSummary ?? 'No summary'}
                </li>
              ))}
            </ul>
          )}
        </div>

        {lead.escalations.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-medium text-gray-900">Escalations</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {lead.escalations.map((escalation) => (
                <li key={escalation.id} className="rounded border border-gray-100 p-2">
                  <span className="font-medium">{escalation.reason}</span> — {escalation.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
