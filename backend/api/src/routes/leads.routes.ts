import { Router } from "express";

import { AuthedRequest, requireAuth, requireServiceKey } from "../middleware/auth";
import { humanRouteLimiter } from "../middleware/rateLimit";
import * as leadService from "../services/leadService";
import {
  createLeadSchema,
  scheduleCallbackSchema,
  updateLeadSchema,
} from "../validation/schemas";

export const leadsRouter = Router();

leadsRouter.post("/", requireServiceKey, async (req, res, next) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const lead = await leadService.createLead(data);
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/", humanRouteLimiter, requireAuth(), async (req, res, next) => {
  try {
    const { status, assignedEmployeeId } = req.query;
    const leads = await leadService.listLeads({
      status: typeof status === "string" ? status : undefined,
      assignedEmployeeId: typeof assignedEmployeeId === "string" ? assignedEmployeeId : undefined,
    });
    res.json(leads);
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/:id", humanRouteLimiter, requireAuth(), async (req, res, next) => {
  try {
    const lead = await leadService.getLead(req.params.id);
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

leadsRouter.patch("/:id", humanRouteLimiter, requireAuth(), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const data = updateLeadSchema.parse(req.body);
    const lead = await leadService.updateLead(req.params.id, data, req.employee);
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

leadsRouter.post("/:id/callback", requireServiceKey, async (req, res, next) => {
  try {
    const { callbackTime, notes } = scheduleCallbackSchema.parse(req.body);
    const lead = await leadService.scheduleCallback(req.params.id, callbackTime, notes);
    res.json(lead);
  } catch (err) {
    next(err);
  }
});
