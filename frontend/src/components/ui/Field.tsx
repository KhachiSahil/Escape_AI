import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const fieldBase =
  'rounded-lg border bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--brand)] focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[var(--brand-tint)]'
const fieldStyle = { borderColor: 'var(--border-hairline)' }

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
      {children}
    </label>
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} style={fieldStyle} {...props} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldBase} ${className}`} style={fieldStyle} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} ${className}`} style={fieldStyle} {...props} />
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-[var(--status-critical-tint)] px-3 py-2 text-sm text-[var(--status-critical)]">
      {children}
    </p>
  )
}
