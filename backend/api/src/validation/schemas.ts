import { z } from "zod";

// Short identity/label fields - names, categories, single-word/short-phrase values.
const shortText = () => z.string().trim().max(255);
// Long-form free text mapped to @db.Text columns (summaries, notes).
const longText = () => z.string().trim().max(5000);

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(255),
});

export const createLeadSchema = z.object({
  name: shortText().optional(),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(255).optional(),
  profession: shortText().optional(),
  experienceLevel: shortText().optional(),
  courseInterested: shortText().optional(),
  budget: shortText().optional(),
  leadSource: shortText().optional(),
});

export const updateLeadSchema = z.object({
  name: shortText().optional(),
  email: z.string().trim().email().max(255).optional(),
  profession: shortText().optional(),
  experienceLevel: shortText().optional(),
  courseInterested: shortText().optional(),
  budget: shortText().optional(),
  status: z
    .enum(["NEW", "QUALIFIED", "CALLBACK_SCHEDULED", "ESCALATED", "CONVERTED", "LOST", "DORMANT"])
    .optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  leadScore: z.enum(["HOT", "WARM", "COLD", "VERY_HOT", "LOST", "DORMANT", "RE_ENGAGE"]).optional(),
  intent: shortText().optional(),
  urgency: shortText().optional(),
  sentiment: shortText().optional(),
  notes: longText().optional(),
  language: shortText().optional(),
  assignedEmployeeId: z.string().cuid().optional(),
});

export const scheduleCallbackSchema = z.object({
  callbackTime: z.coerce.date(),
  notes: longText().optional(),
});

export const createCallSchema = z.object({
  leadId: z.string().cuid(),
  callType: z.enum(["AI_OUTBOUND", "AI_INBOUND", "HUMAN"]),
  handledByEmployeeId: z.string().cuid().optional(),
  shortSummary: shortText().optional(),
  detailedSummary: longText().optional(),
  keyPoints: longText().optional(),
  intent: shortText().optional(),
  urgency: shortText().optional(),
  sentiment: shortText().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  recordingUrl: z.string().trim().url().max(2048).optional(),
  goals: longText().optional(),
  painPoints: longText().optional(),
  nextSteps: longText().optional(),
  buyingSignals: longText().optional(),
  objections: longText().optional(),
  recommendedAction: longText().optional(),
});

export const createEscalationSchema = z.object({
  leadId: z.string().cuid(),
  reason: shortText().min(1),
  summary: longText().optional(),
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]),
});
