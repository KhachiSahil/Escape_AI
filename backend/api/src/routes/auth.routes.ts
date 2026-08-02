import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config";
import { prisma } from "../db";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";
import { humanRouteLimiter, loginLimiter } from "../middleware/rateLimit";
import { loginSchema } from "../validation/schemas";

export const authRouter = Router();

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // matches the JWT's 12h expiresIn

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.nodeEnv === "production",
};

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) throw new HttpError(401, "Invalid credentials");

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) throw new HttpError(401, "Invalid credentials");

    const token = jwt.sign({ sub: employee.id, role: employee.role }, config.jwtSecret, {
      expiresIn: "12h",
    });

    res.cookie("token", token, { ...cookieOptions, maxAge: COOKIE_MAX_AGE_MS });

    res.json({
      // Kept in the body too (in addition to the cookie) so existing
      // Authorization-header-based clients keep working unchanged - both
      // paths are supported indefinitely, not just during a transition.
      token,
      employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", cookieOptions);
  res.status(204).end();
});

authRouter.get("/me", humanRouteLimiter, requireAuth(), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: req.employee.id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!employee) throw new HttpError(401, "Unauthorized");
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});
