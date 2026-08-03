import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Unexpected errors (e.g. Prisma connection/query failures) are logged
  // with the request that triggered them - a bare console.error(err) with
  // no method/path context is nearly impossible to correlate back to which
  // write actually failed once more than one request is in flight.
  // eslint-disable-next-line no-console
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ error: "Internal server error" });
}
