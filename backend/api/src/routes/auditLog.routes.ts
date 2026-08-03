import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { humanRouteLimiter } from "../middleware/rateLimit";
import { listAuditLog } from "../services/auditService";

export const auditLogRouter = Router();

auditLogRouter.get("/", humanRouteLimiter, requireAuth("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    const entries = await listAuditLog({
      entityType: typeof entityType === "string" ? entityType : undefined,
      entityId: typeof entityId === "string" ? entityId : undefined,
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
});
