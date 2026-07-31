import { Router } from "express";

import { requireServiceKey } from "../middleware/auth";
import * as callService from "../services/callService";
import { createCallSchema } from "../validation/schemas";

export const callsRouter = Router();

callsRouter.post("/", requireServiceKey, async (req, res, next) => {
  try {
    const data = createCallSchema.parse(req.body);
    const call = await callService.createCall(data);
    res.status(201).json(call);
  } catch (err) {
    next(err);
  }
});
