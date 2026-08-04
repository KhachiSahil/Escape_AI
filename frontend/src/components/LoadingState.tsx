export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="p-6" role="status" aria-label={label}>
      <div className="space-y-3">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-2/3" />
      </div>
    </div>
  )
}
