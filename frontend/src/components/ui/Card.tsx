import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border bg-[var(--surface-1)] shadow-[var(--shadow-sm)] ${className}`}
      style={{ borderColor: 'var(--border-hairline)' }}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border-hairline)' }}>
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}
