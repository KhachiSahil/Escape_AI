import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../context/useAuth'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { StatusBadge, ScoreBadge } from '../components/LeadStatusBadge'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { FieldError, Label, Select, TextInput, Textarea } from '../components/ui/Field'
import type { LeadDetail, LeadStatus, UpdateLeadInput } from '../types/models'

interface LogCallInput {
  shortSummary: string
  durationSeconds?: number
}

const STATUS_OPTIONS: LeadStatus[] = [
  'NEW',
  'QUALIFIED',
  'CALLBACK_SCHEDULED',
  'ESCALATED',
  'CONVERTED',
  'LOST',
  'DORMANT',
]

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[var(--text-primary)]">{value}</dd>
    </div>
  )
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value ?? '—'}</span>
    </div>
  )
}

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

  const [callSummary, setCallSummary] = useState('')
  const [callDuration, setCallDuration] = useState('')
  const [callFormError, setCallFormError] = useState<string | null>(null)

  const logCallMutation = useMutation({
    mutationFn: (input: LogCallInput) =>
      api.post('/api/calls', {
        leadId: id,
        callType: 'HUMAN',
        handledByEmployeeId: employee?.id,
        shortSummary: input.shortSummary,
        durationSeconds: input.durationSeconds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      setCallSummary('')
      setCallDuration('')
      setCallFormError(null)
    },
    onError: (err) => {
      setCallFormError(err instanceof ApiError ? err.body.error : 'Could not log call')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input: UpdateLeadInput = {}
    if (status) input.status = status
    if (notes) input.notes = notes
    mutation.mutate(input)
  }

  function handleLogCall(event: FormEvent) {
    event.preventDefault()
    if (!callSummary.trim()) {
      setCallFormError('Summary is required')
      return
    }
    logCallMutation.mutate({
      shortSummary: callSummary,
      durationSeconds: callDuration ? Number(callDuration) : undefined,
    })
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <LoadingState label="Loading lead…" />
        </Card>
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState message="Could not load this lead." />
      </div>
    )
  }

  const lead = query.data
  const canEdit =
    employee?.role === 'ADMIN' ||
    employee?.role === 'MANAGER' ||
    (employee?.role === 'SALES_EMPLOYEE' && lead.assignedEmployeeId === employee.id)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
      >
        ← Back to leads
      </Link>

      <Card>
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-hairline)' }}>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{lead.name ?? 'Unnamed lead'}</h1>
          <div className="flex gap-2">
            <StatusBadge status={lead.status} />
            {lead.leadScore && <ScoreBadge score={lead.leadScore} />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-3">
          <DetailRow label="Phone" value={lead.phone} />
          <DetailRow label="Email" value={lead.email ?? '—'} />
          <DetailRow label="Course interested" value={lead.courseInterested ?? '—'} />
          <DetailRow label="Profession" value={lead.profession ?? '—'} />
          <DetailRow label="Budget" value={lead.budget ?? '—'} />
          <DetailRow label="Assigned to" value={lead.assignedEmployee?.name ?? 'Unassigned'} />
        </div>
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border-hairline)' }}>
          <DetailRow label="Notes" value={<span className="whitespace-pre-wrap">{lead.notes ?? '—'}</span>} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Composite score"
          description={
            lead.compositeScore != null
              ? lead.compositeScore.toFixed(1)
              : 'Not enough signal yet'
          }
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4">
          <ScoreRow label="Budget" value={lead.budgetScore} />
          <ScoreRow label="Urgency" value={lead.urgencyScore} />
          <ScoreRow label="Interest" value={lead.interestScore} />
          <ScoreRow label="Buying signals" value={lead.buyingSignalsScore} />
          <ScoreRow label="Course fit" value={lead.courseFitScore} />
          <ScoreRow label="Call quality" value={lead.callQualityScore} />
        </div>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader title="Update lead" />
          <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full sm:w-64"
              >
                <option value="">— unchanged —</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>
            {formError && <FieldError>{formError}</FieldError>}
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title="Call history" />
        <div className="px-5 py-4">
          {lead.calls.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No calls yet.</p>
          ) : (
            <ul className="space-y-2">
              {lead.calls.map((call) => (
                <li
                  key={call.id}
                  className="rounded-lg border p-3 text-sm"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <span className="font-medium text-[var(--text-primary)]">{call.callType}</span>{' '}
                  <span className="text-[var(--text-secondary)]">— {call.shortSummary ?? 'No summary'}</span>
                  {call.recordingUrl && (
                    <audio controls src={call.recordingUrl} className="mt-2 w-full">
                      Your browser does not support audio playback.
                    </audio>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <form onSubmit={handleLogCall} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border-hairline)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Log a call you handled
              </h3>
              <div>
                <Label htmlFor="callSummary">Summary</Label>
                <Textarea
                  id="callSummary"
                  value={callSummary}
                  onChange={(e) => setCallSummary(e.target.value)}
                  rows={2}
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="callDuration">Duration (seconds, optional)</Label>
                <TextInput
                  id="callDuration"
                  type="number"
                  min={0}
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  className="w-32"
                />
              </div>
              {callFormError && <FieldError>{callFormError}</FieldError>}
              <Button type="submit" variant="secondary" disabled={logCallMutation.isPending}>
                {logCallMutation.isPending ? 'Logging…' : 'Log call'}
              </Button>
            </form>
          )}
        </div>
      </Card>

      {lead.escalations.length > 0 && (
        <Card>
          <CardHeader title="Escalations" />
          <ul className="space-y-2 px-5 py-4">
            {lead.escalations.map((escalation) => (
              <li
                key={escalation.id}
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <span className="font-medium text-[var(--text-primary)]">{escalation.reason}</span>{' '}
                <span className="text-[var(--text-secondary)]">— {escalation.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
