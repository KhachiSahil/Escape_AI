export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return <p className="p-6 text-sm text-red-600">{message}</p>
}
