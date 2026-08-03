export type Role = 'ADMIN' | 'MANAGER' | 'SALES_EMPLOYEE'
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'
export type LeadStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CALLBACK_SCHEDULED'
  | 'ESCALATED'
  | 'CONVERTED'
  | 'LOST'
  | 'DORMANT'
export type LeadPriority = 'P1' | 'P2' | 'P3' | 'P4'
export type LeadScore = 'HOT' | 'WARM' | 'COLD' | 'VERY_HOT' | 'LOST' | 'DORMANT' | 'RE_ENGAGE'
export type CallType = 'AI_OUTBOUND' | 'AI_INBOUND' | 'HUMAN'

export interface Employee {
  id: string
  name: string
  email: string
  role: Role
  status: EmployeeStatus
  lastAssignedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  name: string | null
  phone: string
  email: string | null
  profession: string | null
  experienceLevel: string | null
  courseInterested: string | null
  budget: string | null
  leadSource: string
  status: LeadStatus
  priority: LeadPriority | null
  leadScore: LeadScore | null
  intent: string | null
  urgency: string | null
  sentiment: string | null
  budgetScore: number | null
  urgencyScore: number | null
  interestScore: number | null
  buyingSignalsScore: number | null
  courseFitScore: number | null
  callQualityScore: number | null
  compositeScore: number | null
  notes: string | null
  language: string | null
  nextFollowUp: string | null
  humanRequired: boolean
  escalationReason: string | null
  assignedEmployeeId: string | null
  createdAt: string
  updatedAt: string
}

export interface Call {
  id: string
  leadId: string
  callType: CallType
  handledByEmployeeId: string | null
  shortSummary: string | null
  detailedSummary: string | null
  keyPoints: string | null
  intent: string | null
  urgency: string | null
  sentiment: string | null
  durationSeconds: number | null
  recordingUrl: string | null
  transcript: string | null
  goals: string | null
  painPoints: string | null
  nextSteps: string | null
  buyingSignals: string | null
  objections: string | null
  recommendedAction: string | null
  createdAt: string
}

export interface CallWithLead extends Call {
  lead: Pick<Lead, 'name' | 'phone'>
}

export interface Escalation {
  id: string
  leadId: string
  reason: string
  summary: string | null
  assignedEmployeeId: string | null
  status: string
  createdAt: string
}

export interface LeadDetail extends Lead {
  calls: Call[]
  escalations: Escalation[]
  assignedEmployee: Employee | null
}

export interface LoginResponse {
  token: string
  employee: Pick<Employee, 'id' | 'name' | 'email' | 'role'>
}

export interface ApiErrorBody {
  error: string
  details?: {
    formErrors: string[]
    fieldErrors: Record<string, string[]>
  }
}

export interface UpdateLeadInput {
  name?: string
  email?: string
  profession?: string
  experienceLevel?: string
  courseInterested?: string
  budget?: string
  status?: LeadStatus
  priority?: LeadPriority
  leadScore?: LeadScore
  intent?: string
  urgency?: string
  sentiment?: string
  notes?: string
  language?: string
  assignedEmployeeId?: string
  budgetScore?: number
  urgencyScore?: number
  interestScore?: number
  buyingSignalsScore?: number
  courseFitScore?: number
  callQualityScore?: number
}

export interface AnalyticsOverview {
  pipelineByStatus: { status: LeadStatus; count: number }[]
  leadsBySource: { source: string; count: number }[]
  leadsByCourse: { course: string; count: number }[]
  sentimentDistribution: {
    note: string
    data: { sentiment: string; count: number }[]
  }
  callDuration: {
    avgSeconds: number | null
    totalSeconds: number | null
    callsWithDuration: number
  }
  conversionRate: {
    convertedOverTotal: number | null
    convertedOverResolved: number | null
  }
  followUpSuccess: {
    note: string
    convertedAfterFollowUp: number
    notConvertedAfterFollowUp: number
  }
}

export interface EmployeePerformance {
  id: string
  name: string
  email: string
  status: EmployeeStatus
  totalAssigned: number
  byStatus: Record<string, number>
}

export interface EscalationWithLead extends Escalation {
  lead: Lead
  assignedEmployee: Employee | null
}
