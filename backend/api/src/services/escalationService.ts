import { Employee, Prisma } from "@prisma/client";

import { prisma } from "../db";

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
    WHERE status = 'ACTIVE'
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

export async function createEscalation(input: { leadId: string; reason: string; summary?: string }) {
  return prisma.$transaction(async (tx) => {
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
  });
}
