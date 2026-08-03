import { Employee, Prisma } from "@prisma/client";

import { config } from "../config";
import { prisma } from "../db";
import { ADMIN_ROOM, employeeRoom, getIO } from "../realtime/socket";
import { sendEmail } from "./notificationService";

type Tx = Prisma.TransactionClient;

/**
 * Picks the ACTIVE employee who was assigned longest ago (or never),
 * locking that row so a concurrent escalation can't pick the same one.
 *
 * FOR UPDATE SKIP LOCKED means a second concurrent transaction skips past
 * whichever row the first transaction is currently holding and picks the
 * next-oldest instead of blocking or double-assigning - this is what makes
 * round-robin assignment safe under concurrent escalations.
 */
async function pickNextEmployee(tx: Tx): Promise<Employee | null> {
  const rows = await tx.$queryRaw<Employee[]>`
    SELECT * FROM "Employee"
    WHERE status = 'ACTIVE' AND role = 'SALES_EMPLOYEE'
    ORDER BY "lastAssignedAt" ASC NULLS FIRST
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `;
  const employee = rows[0];
  if (!employee) return null;

  await tx.employee.update({
    where: { id: employee.id },
    data: { lastAssignedAt: new Date() },
  });
  return employee;
}

// P1/P2 leads sort first among queued escalations (display/manual-pickup
// ordering only - does not affect which employee round-robin picks, and
// does not preempt an already-assigned escalation). True priority
// preemption is out of scope, per the original spec's own framing of this
// as a future enhancement.
const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

export async function listEscalations(filters: { status?: string } = {}) {
  const escalations = await prisma.escalation.findMany({
    where: filters.status ? { status: filters.status } : undefined,
    include: { lead: true, assignedEmployee: true },
    orderBy: { createdAt: "asc" },
  });

  if (filters.status !== "queued") return escalations;

  return [...escalations].sort((a, b) => {
    const rankA = a.lead.priority ? PRIORITY_RANK[a.lead.priority] : 99;
    const rankB = b.lead.priority ? PRIORITY_RANK[b.lead.priority] : 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export async function createEscalation(input: { leadId: string; reason: string; summary?: string }) {
  const result = await prisma.$transaction(
    async (tx) => {
      const employee = await pickNextEmployee(tx);

      const escalation = await tx.escalation.create({
        data: {
          leadId: input.leadId,
          reason: input.reason,
          summary: input.summary,
          assignedEmployeeId: employee?.id,
          status: employee ? "assigned" : "queued",
        },
      });

      await tx.lead.update({
        where: { id: input.leadId },
        data: {
          humanRequired: true,
          status: "ESCALATED",
          escalationReason: input.reason,
          assignedEmployeeId: employee?.id,
        },
      });

      return { escalation, assignedEmployee: employee };
    },
    // Explicit timeouts (beyond Prisma's 2s/5s defaults) as insurance beyond
    // the non-pooled DATABASE_URL fix - cheap to add, no downside at this
    // app's traffic volume.
    { maxWait: 5000, timeout: 10000 },
  );

  const io = getIO();
  io.to(ADMIN_ROOM).emit("escalation:created", result.escalation);
  if (result.assignedEmployee) {
    io.to(employeeRoom(result.assignedEmployee.id)).emit("escalation:created", result.escalation);
  }

  notifyEscalation(result.escalation, result.assignedEmployee);

  return result;
}

function notifyEscalation(
  escalation: { id: string; reason: string },
  assignedEmployee: Employee | null,
): void {
  if (assignedEmployee) {
    void sendEmail(
      assignedEmployee.email,
      "New escalation assigned to you",
      `You've been assigned escalation ${escalation.id} (reason: ${escalation.reason}). Please follow up.`,
    );
  } else if (config.adminNotificationEmail) {
    void sendEmail(
      config.adminNotificationEmail,
      "Escalation queued - no employee available",
      `Escalation ${escalation.id} (reason: ${escalation.reason}) is queued with no ACTIVE sales employee available.`,
    );
  }
}
