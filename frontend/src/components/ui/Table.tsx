import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b" style={{ borderColor: 'var(--border-hairline)' }}>
        {children}
      </tr>
    </thead>
  )
}

export function Th({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] ${className}`}
      {...props}
    />
  )
}

export function Tr({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b transition-colors last:border-0 hover:bg-[var(--surface-2)] ${className}`}
      style={{ borderColor: 'var(--border-hairline)' }}
      {...props}
    />
  )
}

export function Td({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-[var(--text-primary)] ${className}`} {...props} />
}
