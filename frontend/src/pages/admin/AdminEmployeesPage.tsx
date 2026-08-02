import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import type { Employee, EmployeeStatus, EmployeePerformance } from '../../types/models'

const STATUS_OPTIONS: EmployeeStatus[] = ['ACTIVE', 'ON_LEAVE', 'INACTIVE']

export function AdminEmployeesPage() {
  const queryClient = useQueryClient()

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/api/employees'),
  })

  const performanceQuery = useQuery({
    queryKey: ['employee-performance'],
    queryFn: () => api.get<EmployeePerformance[]>('/api/analytics/employee-performance'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EmployeeStatus }) =>
      api.patch<Employee>(`/api/employees/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-performance'] })
    },
  })

  if (employeesQuery.isLoading) return <LoadingState label="Loading employees…" />
  if (employeesQuery.isError || !employeesQuery.data) {
    return <ErrorState message="Could not load employees." />
  }

  const performanceById = new Map(
    (performanceQuery.data ?? []).map((perf) => [perf.id, perf]),
  )

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Employees</h1>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Assigned leads</th>
              <th className="p-3 font-medium">Status change</th>
            </tr>
          </thead>
          <tbody>
            {employeesQuery.data.map((employee) => {
              const perf = performanceById.get(employee.id)
              return (
                <tr key={employee.id} className="border-b border-gray-100">
                  <td className="p-3">{employee.name}</td>
                  <td className="p-3">{employee.email}</td>
                  <td className="p-3">{employee.role}</td>
                  <td className="p-3">{employee.status}</td>
                  <td className="p-3">
                    {perf
                      ? `${perf.totalAssigned} total (${Object.entries(perf.byStatus)
                          .map(([status, count]) => `${status}: ${count}`)
                          .join(', ') || 'none'})`
                      : '—'}
                  </td>
                  <td className="p-3">
                    <select
                      value={employee.status}
                      onChange={(e) =>
                        statusMutation.mutate({
                          id: employee.id,
                          status: e.target.value as EmployeeStatus,
                        })
                      }
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
