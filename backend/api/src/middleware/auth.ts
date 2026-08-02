import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config";
import { Role } from "@prisma/client";

export interface AuthedRequest extends Request {
  employee?: { id: string; role: Role };
  isService?: boolean;
}

/** Accepts either a valid employee JWT (role-checked) OR the shared service key. */
export function requireAuth(...allowedRoles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const serviceKey = req.header("X-Service-Key");
    if (serviceKey && serviceKey === config.serviceApiKey) {
      req.isService = true;
      return next();
    }

    // Cookie first (browser sessions), Authorization header as a fallback
    // (kept supported indefinitely - no downside, and it's what the Python
    // voice agent's dashboard-adjacent tooling or any non-browser client
    // would use).
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.token;
    const authHeader = req.header("Authorization");
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    const token = cookieToken ?? headerToken;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as { sub: string; role: Role };
      if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.employee = { id: payload.sub, role: payload.role };
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

/** Service-key-only auth for endpoints the voice agent calls exclusively. */
export function requireServiceKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const serviceKey = req.header("X-Service-Key");
  if (!serviceKey || serviceKey !== config.serviceApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.isService = true;
  next();
}
