import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuditLogCreate, mockAuditLogFindMany } = vi.hoisted(() => ({
  mockAuditLogCreate: vi.fn().mockResolvedValue({}),
  mockAuditLogFindMany: vi.fn(),
}));

vi.mock("../db", () => ({
  prisma: {
    auditLog: {
      create: mockAuditLogCreate,
      findMany: mockAuditLogFindMany,
    },
  },
}));

import { listAuditLog, logAudit } from "./auditService";

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes an entry with the actor id and changes provided", async () => {
    logAudit({
      entityType: "Lead",
      entityId: "lead-1",
      action: "updated",
      actorId: "emp-1",
      changes: { status: "QUALIFIED" },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        entityType: "Lead",
        entityId: "lead-1",
        action: "updated",
        actorId: "emp-1",
        changes: { status: "QUALIFIED" },
      },
    });
  });

  it("defaults actorId to null for system/service-key actions", async () => {
    logAudit({ entityType: "Escalation", entityId: "esc-1", action: "created" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        entityType: "Escalation",
        entityId: "esc-1",
        action: "created",
        actorId: null,
        changes: undefined,
      },
    });
  });

  it("does not throw when the write fails", async () => {
    mockAuditLogCreate.mockRejectedValueOnce(new Error("db down"));

    expect(() => logAudit({ entityType: "Call", entityId: "call-1", action: "created" })).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe("listAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by entityType/entityId when provided", async () => {
    mockAuditLogFindMany.mockResolvedValue([]);

    await listAuditLog({ entityType: "Lead", entityId: "lead-1" });

    expect(mockAuditLogFindMany).toHaveBeenCalledWith({
      where: { entityType: "Lead", entityId: "lead-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});
