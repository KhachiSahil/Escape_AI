import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { humanRouteLimiter } from "../middleware/rateLimit";
import * as analyticsService from "../services/analyticsService";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/overview",
  humanRouteLimiter,
  requireAuth("ADMIN", "MANAGER"),
  async (_req, res, next) => {
    try {
      const overview = await analyticsService.getOverview();
      res.json(overview);
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  "/employee-performance",
  humanRouteLimiter,
  requireAuth("ADMIN", "MANAGER"),
  async (_req, res, next) => {
    try {
      const performance = await analyticsService.getEmployeePerformance();
      res.json(performance);
    } catch (err) {
      next(err);
    }
  },
);
