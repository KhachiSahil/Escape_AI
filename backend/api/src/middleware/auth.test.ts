import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../config", () => ({
  config: { jwtSecret: "test-secret", serviceApiKey: "test-service-key" },
}));

import { requireAuth } from "./auth";

function mockReqRes(overrides: {
  cookies?: Record<string, string>;
  authorization?: string;
  serviceKey?: string;
}) {
  const headers: Record<string, string> = {};
  if (overrides.authorization) headers.Authorization = overrides.authorization;
  if (overrides.serviceKey) headers["X-Service-Key"] = overrides.serviceKey;

  const req = {
    cookies: overrides.cookies ?? {},
    header: (name: string) => headers[name],
  };
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

function signToken(role: string, secret = "test-secret") {
  return jwt.sign({ sub: "emp-1", role }, secret);
}

describe("requireAuth", () => {
  it("accepts a valid cookie token", () => {
    const { req, res, next } = mockReqRes({ cookies: { token: signToken("ADMIN") } });
    requireAuth()(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect((req as { employee?: { role: string } }).employee?.role).toBe("ADMIN");
  });

  it("accepts a valid Authorization header token (fallback)", () => {
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${signToken("MANAGER")}` });
    requireAuth()(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect((req as { employee?: { role: string } }).employee?.role).toBe("MANAGER");
  });

  it("prefers the cookie over the header when both are present", () => {
    const { req, res, next } = mockReqRes({
      cookies: { token: signToken("ADMIN") },
      authorization: `Bearer ${signToken("SALES_EMPLOYEE")}`,
    });
    requireAuth()(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect((req as { employee?: { role: string } }).employee?.role).toBe("ADMIN");
  });

  it("accepts a valid service key, bypassing JWT entirely", () => {
    const { req, res, next } = mockReqRes({ serviceKey: "test-service-key" });
    requireAuth()(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect((req as { isService?: boolean }).isService).toBe(true);
  });

  it("rejects a missing token with 401", () => {
    const { req, res, next } = mockReqRes({});
    requireAuth()(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects an invalid/expired token with 401", () => {
    const { req, res, next } = mockReqRes({ cookies: { token: signToken("ADMIN", "wrong-secret") } });
    requireAuth()(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a role not in the allowed list with 403", () => {
    const { req, res, next } = mockReqRes({ cookies: { token: signToken("SALES_EMPLOYEE") } });
    requireAuth("ADMIN", "MANAGER")(req as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
