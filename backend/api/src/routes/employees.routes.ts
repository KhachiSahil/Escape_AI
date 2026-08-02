import { Router } from "express";

import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { updateEmployeeStatusSchema } from "../validation/schemas";

export const employeesRouter = Router();

employeesRouter.get("/", requireAuth("ADMIN", "MANAGER"), async (_req, res, next) => {
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

employeesRouter.patch("/:id/status", requireAuth("ADMIN", "MANAGER"), async (req, res, next) => {
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
    res.json(employee);
  } catch (err) {
    next(err);
  }
});
