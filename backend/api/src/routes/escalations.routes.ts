import { Router } from "express";

import { requireServiceKey } from "../middleware/auth";
import * as escalationService from "../services/escalationService";
import { createEscalationSchema } from "../validation/schemas";

export const escalationsRouter = Router();

escalationsRouter.post("/", requireServiceKey, async (req, res, next) => {
  try {
    const data = createEscalationSchema.parse(req.body);
    const { escalation, assignedEmployee } = await escalationService.createEscalation(data);
    res.status(201).json({
      escalationId: escalation.id,
      status: escalation.status,
      assignedEmployee: assignedEmployee
        ? { id: assignedEmployee.id, name: assignedEmployee.name }
        : null,
    });
  } catch (err) {
    next(err);
  }
});
