import { Prisma } from "@prisma/client";

import { prisma } from "../db";

/**
 * Fire-and-forget audit trail write. Never blocks or fails the mutation it
 * documents - a logging outage must not break lead/call/escalation/employee
 * writes, so errors are logged, not thrown or awaited by callers.
 */
export function logAudit(entry: {
  entityType: "Lead" | "Employee" | "Escalation" | "Call";
  entityId: string;
  action: string;
  actorId?: string | null;
  changes?: Record<string, unknown>;
}): void {
  void prisma.auditLog
    .create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actorId: entry.actorId ?? null,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((err) => {
      console.error("Failed to write audit log entry:", err);
    });
}

export function listAuditLog(filters: { entityType?: string; entityId?: string }) {
  return prisma.auditLog.findMany({
    where: {
      entityType: filters.entityType,
      entityId: filters.entityId,
    },
    orderBy: { createdAt: "desc" },
  });
}
