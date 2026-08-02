import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  profession: z.string().optional(),
  experienceLevel: z.string().optional(),
  courseInterested: z.string().optional(),
  budget: z.string().optional(),
  leadSource: z.string().optional(),
});

export const updateLeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  profession: z.string().optional(),
  experienceLevel: z.string().optional(),
  courseInterested: z.string().optional(),
  budget: z.string().optional(),
  status: z
    .enum(["NEW", "QUALIFIED", "CALLBACK_SCHEDULED", "ESCALATED", "CONVERTED", "LOST", "DORMANT"])
    .optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  leadScore: z.enum(["HOT", "WARM", "COLD", "VERY_HOT", "LOST", "DORMANT", "RE_ENGAGE"]).optional(),
  intent: z.string().optional(),
  urgency: z.string().optional(),
  sentiment: z.string().optional(),
  notes: z.string().optional(),
  language: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
});

export const scheduleCallbackSchema = z.object({
  callbackTime: z.coerce.date(),
  notes: z.string().optional(),
});

export const createCallSchema = z.object({
  leadId: z.string().min(1),
  callType: z.enum(["AI_OUTBOUND", "AI_INBOUND", "HUMAN"]),
  shortSummary: z.string().optional(),
  detailedSummary: z.string().optional(),
  keyPoints: z.string().optional(),
  intent: z.string().optional(),
  urgency: z.string().optional(),
  sentiment: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  recordingUrl: z.string().optional(),
  goals: z.string().optional(),
  painPoints: z.string().optional(),
  nextSteps: z.string().optional(),
  buyingSignals: z.string().optional(),
  objections: z.string().optional(),
  recommendedAction: z.string().optional(),
});

export const createEscalationSchema = z.object({
  leadId: z.string().min(1),
  reason: z.string().min(1),
  summary: z.string().optional(),
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]),
});
