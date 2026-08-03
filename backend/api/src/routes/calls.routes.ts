import { Router } from "express";

import { AuthedRequest, requireAuth } from "../middleware/auth";
import { humanRouteLimiter } from "../middleware/rateLimit";
import * as callService from "../services/callService";
import { createCallSchema, listCallsQuerySchema } from "../validation/schemas";

export const callsRouter = Router();

// requireAuth() (not requireServiceKey) accepts both the voice agent's
// service key AND a human's JWT - the voice agent logs AI_* calls, humans
// log HUMAN calls from LeadDetailPage's manual-log form.
callsRouter.post("/", requireAuth(), async (req: AuthedRequest, res, next) => {
  try {
    const data = createCallSchema.parse(req.body);
    const call = await callService.createCall(data, req.employee?.id);
    res.status(201).json(call);
  } catch (err) {
    next(err);
  }
});

callsRouter.get("/", humanRouteLimiter, requireAuth(), async (req, res, next) => {
  try {
    const query = listCallsQuerySchema.parse(req.query);
    const calls = await callService.listCalls(query);
    res.json(calls);
  } catch (err) {
    next(err);
  }
});
