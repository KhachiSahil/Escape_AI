import rateLimit from "express-rate-limit";

/** Strict - login is a brute-force target. */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

/**
 * Moderate limit for JWT-protected human/dashboard routes. Deliberately NOT
 * applied to service-key routes (used by the trusted voice agent, which can
 * make many legitimate calls per conversation) - attach this per-route only
 * on the JWT-protected route definitions, not globally.
 */
export const humanRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
