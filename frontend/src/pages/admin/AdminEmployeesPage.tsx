import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Field'
import { Table, Thead, Th, Tr, Td } from '../../components/ui/Table'
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

  const onlineQuery = useQuery({
    queryKey: ['employees', 'online'],
    queryFn: () => api.get<string[]>('/api/employees/online'),
  })
  const onlineIds = new Set(onlineQuery.data ?? [])

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EmployeeStatus }) =>
      api.patch<Employee>(`/api/employees/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee-performance'] })
    },
  })

  if (employeesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <LoadingState label="Loading employees…" />
        </Card>
      </div>
    )
  }
  if (employeesQuery.isError || !employeesQuery.data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <ErrorState message="Could not load employees." />
      </div>
    )
  }

  const performanceById = new Map(
    (performanceQuery.data ?? []).map((perf) => [perf.id, perf]),
  )

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-[var(--text-primary)]">Employees</h1>
      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th>Assigned leads</Th>
            <Th>Status change</Th>
          </Thead>
          <tbody>
            {employeesQuery.data.map((employee) => {
              const perf = performanceById.get(employee.id)
              const online = onlineIds.has(employee.id)
              return (
                <Tr key={employee.id}>
                  <Td className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: online ? 'var(--status-good)' : 'var(--border-strong)' }}
                        title={online ? 'Online' : 'Offline'}
                      />
                      {employee.name}
                    </span>
                  </Td>
                  <Td className="text-[var(--text-secondary)]">{employee.email}</Td>
                  <Td className="text-[var(--text-secondary)]">{employee.role}</Td>
                  <Td className="text-[var(--text-secondary)]">{employee.status}</Td>
                  <Td className="text-[var(--text-secondary)]">
                    {perf
                      ? `${perf.totalAssigned} total (${Object.entries(perf.byStatus)
                          .map(([status, count]) => `${status}: ${count}`)
                          .join(', ') || 'none'})`
                      : '—'}
                  </Td>
                  <Td>
                    <Select
                      value={employee.status}
                      onChange={(e) =>
                        statusMutation.mutate({
                          id: employee.id,
                          status: e.target.value as EmployeeStatus,
                        })
                      }
                      className="w-auto"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
