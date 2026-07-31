import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config";
import { prisma } from "../db";
import { HttpError } from "../middleware/errorHandler";
import { loginSchema } from "../validation/schemas";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) throw new HttpError(401, "Invalid credentials");

    const valid = await bcrypt.compare(password, employee.passwordHash);
    if (!valid) throw new HttpError(401, "Invalid credentials");

    const token = jwt.sign({ sub: employee.id, role: employee.role }, config.jwtSecret, {
      expiresIn: "12h",
    });

    res.json({
      token,
      employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
    });
  } catch (err) {
    next(err);
  }
});
