export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-[var(--status-critical-tint)] p-4 text-sm text-[var(--status-critical)]" style={{ borderColor: 'var(--border-hairline)' }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10" cy="13.5" r="1" fill="currentColor" />
      </svg>
      <span>{message}</span>
    </div>
  )
}
