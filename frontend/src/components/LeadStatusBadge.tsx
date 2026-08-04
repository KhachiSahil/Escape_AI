import type { LeadScore, LeadStatus } from '../types/models'

// Tint/ink pairs drawn from the categorical palette (src/lib/chartColors.ts)
// plus the fixed status palette - never raw Tailwind color utilities, so
// these stay correct across light/dark automatically.
const STATUS_STYLES: Record<LeadStatus, { bg: string; fg: string }> = {
  NEW: { bg: 'var(--surface-2)', fg: 'var(--text-secondary)' },
  QUALIFIED: { bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  CALLBACK_SCHEDULED: { bg: 'var(--status-warning-tint)', fg: 'var(--status-warning)' },
  ESCALATED: { bg: 'var(--status-serious-tint)', fg: 'var(--status-serious)' },
  CONVERTED: { bg: 'var(--status-good-tint)', fg: 'var(--status-good)' },
  LOST: { bg: 'var(--status-critical-tint)', fg: 'var(--status-critical)' },
  DORMANT: { bg: 'var(--surface-2)', fg: 'var(--text-muted)' },
}

const SCORE_STYLES: Record<LeadScore, { bg: string; fg: string }> = {
  VERY_HOT: { bg: 'var(--status-critical-tint)', fg: 'var(--status-critical)' },
  HOT: { bg: 'var(--status-serious-tint)', fg: 'var(--status-serious)' },
  WARM: { bg: 'var(--status-warning-tint)', fg: 'var(--status-warning)' },
  COLD: { bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  RE_ENGAGE: { bg: 'var(--surface-2)', fg: 'var(--text-secondary)' },
  DORMANT: { bg: 'var(--surface-2)', fg: 'var(--text-muted)' },
  LOST: { bg: 'var(--surface-2)', fg: 'var(--text-muted)' },
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const style = STATUS_STYLES[status]
  return <Badge label={status.replace(/_/g, ' ')} bg={style.bg} fg={style.fg} />
}

export function ScoreBadge({ score }: { score: LeadScore }) {
  const style = SCORE_STYLES[score]
  return <Badge label={score.replace(/_/g, ' ')} bg={style.bg} fg={style.fg} />
}
