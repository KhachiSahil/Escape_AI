import type { LeadScore, LeadStatus } from '../types/models'

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  CALLBACK_SCHEDULED: 'bg-amber-100 text-amber-700',
  ESCALATED: 'bg-orange-100 text-orange-700',
  CONVERTED: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
  DORMANT: 'bg-slate-100 text-slate-500',
}

const SCORE_STYLES: Record<LeadScore, string> = {
  HOT: 'bg-red-100 text-red-700',
  VERY_HOT: 'bg-red-200 text-red-800',
  WARM: 'bg-amber-100 text-amber-700',
  COLD: 'bg-sky-100 text-sky-700',
  LOST: 'bg-gray-200 text-gray-600',
  DORMANT: 'bg-slate-100 text-slate-500',
  RE_ENGAGE: 'bg-purple-100 text-purple-700',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge label={status.replace(/_/g, ' ')} className={STATUS_STYLES[status]} />
}

export function ScoreBadge({ score }: { score: LeadScore }) {
  return <Badge label={score.replace(/_/g, ' ')} className={SCORE_STYLES[score]} />
}
