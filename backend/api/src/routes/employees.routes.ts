import { Router } from "express";

import { prisma } from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { humanRouteLimiter } from "../middleware/rateLimit";
import { getOnlineEmployeeIds } from "../realtime/socket";
import { logAudit } from "../services/auditService";
import { updateEmployeeStatusSchema } from "../validation/schemas";

export const employeesRouter = Router();

employeesRouter.get(
  "/online",
  humanRouteLimiter,
  requireAuth("ADMIN", "MANAGER"),
  (_req, res) => {
    res.json(getOnlineEmployeeIds());
  },
);

employeesRouter.get("/", humanRouteLimiter, requireAuth("ADMIN", "MANAGER"), async (_req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastAssignedAt: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

employeesRouter.patch(
  "/:id/status",
  humanRouteLimiter,
  requireAuth("ADMIN", "MANAGER"),
  async (req: AuthedRequest, res, next) => {
    try {
      const { status } = updateEmployeeStatusSchema.parse(req.body);
      const employee = await prisma.employee.update({
        where: { id: req.params.id },
        data: { status },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          lastAssignedAt: true,
        },
      });
      logAudit({
        entityType: "Employee",
        entityId: employee.id,
        action: "status_changed",
        actorId: req.employee?.id,
        changes: { status },
      });
      res.json(employee);
    } catch (err) {
      next(err);
    }
  },
);
