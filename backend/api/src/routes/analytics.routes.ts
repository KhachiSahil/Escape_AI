import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import * as analyticsService from "../services/analyticsService";

export const analyticsRouter = Router();

analyticsRouter.get("/overview", requireAuth("ADMIN", "MANAGER"), async (_req, res, next) => {
  try {
    const overview = await analyticsService.getOverview();
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get(
  "/employee-performance",
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
